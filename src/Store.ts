import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools, persist } from 'zustand/middleware';
import { MediaRecorder as ExtMediaRecorder, register } from 'extendable-media-recorder';
import { connect as connectWavEncoder } from 'extendable-media-recorder-wav-encoder';
import { prepareAudioForTranscription, prepareAudioForDebug, transcribe, resampleWavBlob, generateRequestId, getWavDurationMs, type TranscriptionResult } from './audio';

// Initialize WAV encoder (runs once)
let wavEncoderRegistered = false;
async function ensureWavEncoder() {
  if (wavEncoderRegistered) return;
  await register(await connectWavEncoder());
  wavEncoderRegistered = true;
  console.log('WAV encoder registered');
}

export type CaptureMethod = 'worklet' | 'mediarecorder';

// Audio resources kept outside Immer (mutable)
const audioResources = {
  audioContext: null as AudioContext | null,
  mediaStream: null as MediaStream | null,
  gainNode: null as GainNode | null,
  workletNode: null as AudioWorkletNode | null,
  // Fallback for browsers without AudioWorklet support
  processor: null as ScriptProcessorNode | null,
  // MediaRecorder capture method
  mediaRecorder: null as InstanceType<typeof ExtMediaRecorder> | null,
  recordedBlobs: [] as Blob[],
  audioBuffer: [] as Float32Array[],
  chunkTimer: null as number | null,
  // Store last recording for debug downloads
  lastRecording: {
    chunks: [] as Float32Array[],
    sampleRate: 0,
  },
  // Store last WAV blob for MediaRecorder method
  lastWavBlob: null as Blob | null,
};

// Resources for VAD gain-adjusted stream (separate from main capture)
const vadAudioResources = {
  audioContext: null as AudioContext | null,
  mediaStream: null as MediaStream | null,
};

/**
 * Creates a gain-adjusted MediaStream for VAD.
 * This allows the same input gain setting to apply to VAD audio.
 */
export async function createGainAdjustedStream(
  constraints: MediaTrackConstraints,
  gain: number
): Promise<MediaStream> {
  // Clean up any previous VAD audio context
  if (vadAudioResources.audioContext) {
    await vadAudioResources.audioContext.close();
  }
  vadAudioResources.mediaStream?.getTracks().forEach(t => t.stop());

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: constraints,
    video: false,
  });

  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  const gainNode = audioContext.createGain();
  gainNode.gain.value = gain;

  // Create a destination node to get a new MediaStream with gain applied
  const destination = audioContext.createMediaStreamDestination();

  source.connect(gainNode);
  gainNode.connect(destination);

  // Keep references for cleanup
  vadAudioResources.audioContext = audioContext;
  vadAudioResources.mediaStream = stream;

  console.log(`VAD stream created with gain ${(gain * 100).toFixed(0)}%`);
  return destination.stream;
}

// Audio processing settings type
export type AudioProcessingSettings = {
  echoCancellation: boolean;
  autoGainControl: boolean;
  noiseSuppression: boolean;
};

// Build microphone constraints based on settings
function buildMicrophoneConstraints(settings: AudioProcessingSettings): MediaTrackConstraints {
  return {
    channelCount: 1,
    sampleRate: { ideal: 48000 },
    echoCancellation: settings.echoCancellation,
    autoGainControl: settings.autoGainControl,
    noiseSuppression: settings.noiseSuppression,
  };
}

const DEFAULT_CHUNK_INTERVAL = 5;

type ServerStatus = 'unknown' | 'ok' | 'loading' | 'error';

type State = {
  // Recording state
  isRecording: boolean;
  isProcessing: boolean;
  isFinalizing: boolean; // Waiting for pending API calls to complete
  isSpeaking: boolean; // VAD detected active speech
  transcript: string;
  statusMessage: string;
  serverStatus: ServerStatus;

  // Settings (persisted)
  serverUrl: string;
  language: string;
  systemPrompt: string; // System prompt for ASR (e.g., spelling hints)
  normalizeProbes: boolean; // Convert "L four fifteen" → "L-415"
  settingsOpen: boolean;
  heroExpanded: boolean;
  sectionState: Record<string, boolean>; // Collapsible section open/close state
  realtimeMode: boolean;
  chunkInterval: number;
  vadEnabled: boolean;
  vadSystem: string;
  vadPositiveThreshold: number;
  vadNegativeThreshold: number;
  vadRedemptionMs: number;
  vadPreSpeechPadMs: number;
  vadMinSpeechMs: number;

  // Audio capture settings
  echoCancellation: boolean;
  autoGainControl: boolean;
  noiseSuppression: boolean;
  inputGain: number; // Input gain multiplier (0.1 to 1.0)
  captureMethod: CaptureMethod; // 'worklet' or 'mediarecorder'

  // Realtime transcripts
  transcripts: string[];

  // VAD status
  vadStatus: string;
  vadLoading: boolean;

  // ASR status
  asrStatus: string;

  // RT tracking for analytics (server-side metrics)
  rtHistory: Array<{
    timestamp: number;      // Date.now()
    rtFactor: number;       // Realtime factor from API
    totalMs: number;        // Total inference time
    tokS: number;           // Tokens per second
  }>;

  // E2E request tracking (client-side measurement)
  requestHistory: Array<{
    requestId: string;
    timestamp: number;        // When request completed
    audioDurationMs: number;  // Audio duration
    serverTotalMs: number;    // Server processing time (from API)
    e2eMs: number;            // End-to-end latency (request sent → response received)
    overheadMs: number;       // Network + queuing overhead (e2eMs - serverTotalMs)
    overheadPercent: number;  // Overhead as percentage of E2E
    wasQueued: boolean;       // True if other requests were pending when this started
  }>;

  // Pending requests
  pendingRequests: Array<{
    requestId: string;
    startTime: number;        // Date.now() when request was sent
    audioDurationMs: number;  // Audio duration for context
    wasQueued: boolean;       // True if other requests were pending when this started
  }>;

  // Debug: audio preview and download
  hasRecordedAudio: boolean;
  rawAudioUrl: string | null;
  processedAudioUrl: string | null;
}

type Actions = {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  abortSession: () => void;
  toggleRecording: () => void;
  setServerUrl: (url: string) => void;
  setLanguage: (lang: string) => void;
  setSystemPrompt: (prompt: string) => void;
  fetchSystemPrompt: () => Promise<void>;
  syncSystemPrompt: () => Promise<void>;
  setNormalizeProbes: (enabled: boolean) => void;
  fetchNormalizeProbes: () => Promise<void>;
  syncNormalizeProbes: () => Promise<void>;
  toggleSettings: () => void;
  toggleHero: () => void;
  toggleRealtime: () => void;
  setChunkInterval: (seconds: number) => void;
  toggleVad: () => void;
  setVadSystem: (system: string) => void;
  setVadPositiveThreshold: (v: number) => void;
  setVadNegativeThreshold: (v: number) => void;
  setVadRedemptionMs: (v: number) => void;
  setVadPreSpeechPadMs: (v: number) => void;
  setVadMinSpeechMs: (v: number) => void;
  setStatusMessage: (msg: string) => void;
  checkServerHealth: () => Promise<void>;
  downloadRawAudio: () => void;
  downloadProcessedAudio: () => void;
  setEchoCancellation: (enabled: boolean) => void;
  setAutoGainControl: (enabled: boolean) => void;
  setNoiseSuppression: (enabled: boolean) => void;
  setInputGain: (gain: number) => void;
  setCaptureMethod: (method: CaptureMethod) => void;
  prepareAudioPreview: () => Promise<void>;
  setSectionOpen: (section: string, isOpen: boolean) => void;
  addRTDataPoint: (result: TranscriptionResult) => void;
  // E2E request tracking
  trackRequestStart: (requestId: string, audioDurationMs: number) => void;
  trackRequestComplete: (requestId: string, result: TranscriptionResult) => void;
}

// Helper function to generate recording status message based on current settings
function getRecordingStatusMessage(state: State): string {
  if (!state.isRecording) {
    return state.statusMessage; // Keep existing message when not recording
  }

  if (state.realtimeMode && state.vadEnabled) {
    return 'Realtime mode: sending when speech detected. Click to stop.';
  } else if (state.realtimeMode) {
    return `Realtime mode: streaming every ${state.chunkInterval}s. Click to stop.`;
  } else {
    return 'Recording... Click to stop.';
  }
}

export const useStore = create<State & Actions>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        isRecording: false,
        isProcessing: false,
        isFinalizing: false,
        isSpeaking: false,
        transcript: '',
        statusMessage: 'Click the sphere to start recording.',
        serverStatus: 'unknown' as ServerStatus,
        serverUrl: 'http://localhost:8080',
        language: 'English',
        systemPrompt: '',
        normalizeProbes: false,
        settingsOpen: false,
        heroExpanded: true,
        sectionState: { server: true, asr: false, audio: false, vad: false, analytics: false, latency: true },
        realtimeMode: false,
        chunkInterval: DEFAULT_CHUNK_INTERVAL,
        vadEnabled: false,
        vadSystem: 'silero',
        vadPositiveThreshold: 0.5,
        vadNegativeThreshold: 0.35,
        vadRedemptionMs: 800,
        vadPreSpeechPadMs: 500,
        vadMinSpeechMs: 250,
        echoCancellation: true,
        autoGainControl: true,
        noiseSuppression: true,
        inputGain: 0.5,
        captureMethod: 'worklet' as CaptureMethod,
        transcripts: [],
        vadStatus: '',
        vadLoading: false,
        asrStatus: '',
        rtHistory: [],
        requestHistory: [],
        pendingRequests: [],
        hasRecordedAudio: false,
        rawAudioUrl: null,
        processedAudioUrl: null,

        checkServerHealth: async () => {
          const state = get();
          const url = state.serverUrl.replace(/\/+$/, '');
          try {
            const response = await fetch(`${url}/health`, {
              method: 'GET',
              signal: AbortSignal.timeout(3000),
            });
            const data = await response.json();
            set((s) => {
              s.serverStatus = data.status === 'ok' ? 'ok' : 'loading';
            });
          } catch {
            set((s) => {
              s.serverStatus = 'error';
            });
          }
        },

        setStatusMessage: (msg: string) => {
          set((state) => {
            state.statusMessage = msg;
          });
        },

        setServerUrl: (url: string) => {
          set((state) => {
            state.serverUrl = url;
          });
        },

        setLanguage: (lang: string) => {
          set((state) => {
            state.language = lang;
          });
        },

        setSystemPrompt: (prompt: string) => {
          set((state) => {
            state.systemPrompt = prompt;
          });
        },

        fetchSystemPrompt: async () => {
          const state = get();
          const url = state.serverUrl.replace(/\/+$/, '');
          try {
            const response = await fetch(`${url}/prompt`, {
              method: 'GET',
              signal: AbortSignal.timeout(3000),
            });
            if (response.ok) {
              const data = await response.json();
              set((s) => {
                s.systemPrompt = data.prompt || '';
              });
            }
          } catch {
            // Ignore errors - server might not support prompt endpoint
          }
        },

        syncSystemPrompt: async () => {
          const state = get();
          const url = state.serverUrl.replace(/\/+$/, '');
          try {
            const formData = new FormData();
            formData.append('prompt', state.systemPrompt);
            const response = await fetch(`${url}/prompt`, {
              method: 'POST',
              body: formData,
              signal: AbortSignal.timeout(3000),
            });
            if (response.ok) {
              const data = await response.json();
              console.log('System prompt synced:', data.status);
            }
          } catch (err) {
            console.error('Failed to sync system prompt:', err);
          }
        },

        setNormalizeProbes: (enabled: boolean) => {
          set((state) => {
            state.normalizeProbes = enabled;
          });
          // Immediately sync to server
          get().syncNormalizeProbes();
        },

        fetchNormalizeProbes: async () => {
          const state = get();
          const url = state.serverUrl.replace(/\/+$/, '');
          try {
            const response = await fetch(`${url}/normalize`, {
              method: 'GET',
              signal: AbortSignal.timeout(3000),
            });
            if (response.ok) {
              const data = await response.json();
              set((s) => {
                s.normalizeProbes = data.normalize_probes || false;
              });
            }
          } catch {
            // Ignore errors - server might not support normalize endpoint
          }
        },

        syncNormalizeProbes: async () => {
          const state = get();
          const url = state.serverUrl.replace(/\/+$/, '');
          try {
            const formData = new FormData();
            formData.append('normalize_probes', state.normalizeProbes ? 'true' : 'false');
            const response = await fetch(`${url}/normalize`, {
              method: 'POST',
              body: formData,
              signal: AbortSignal.timeout(3000),
            });
            if (response.ok) {
              const data = await response.json();
              console.log('Probe normalization synced:', data.normalize_probes);
            }
          } catch (err) {
            console.error('Failed to sync normalize setting:', err);
          }
        },

        toggleSettings: () => {
          set((state) => {
            state.settingsOpen = !state.settingsOpen;
          });
        },

        toggleHero: () => {
          set((state) => {
            state.heroExpanded = !state.heroExpanded;
          });
        },

        toggleRealtime: () => {
          set((state) => {
            state.realtimeMode = !state.realtimeMode;
            state.statusMessage = getRecordingStatusMessage(state);
          });
        },

        setChunkInterval: (seconds: number) => {
          const n = Math.max(1, Math.round(seconds));
          set((state) => {
            state.chunkInterval = n;
            state.statusMessage = getRecordingStatusMessage(state);
          });
        },

        toggleVad: () => {
          set((state) => {
            state.vadEnabled = !state.vadEnabled;
            state.statusMessage = getRecordingStatusMessage(state);
          });
        },

        setVadSystem: (system: string) => {
          set((state) => {
            state.vadSystem = system;
          });
        },

        setVadPositiveThreshold: (v: number) => {
          set((state) => { state.vadPositiveThreshold = Math.min(1, Math.max(0, v)); });
        },
        setVadNegativeThreshold: (v: number) => {
          set((state) => { state.vadNegativeThreshold = Math.min(1, Math.max(0, v)); });
        },
        setVadRedemptionMs: (v: number) => {
          set((state) => { state.vadRedemptionMs = Math.max(0, Math.round(v)); });
        },
        setVadPreSpeechPadMs: (v: number) => {
          set((state) => { state.vadPreSpeechPadMs = Math.max(0, Math.round(v)); });
        },
        setVadMinSpeechMs: (v: number) => {
          set((state) => { state.vadMinSpeechMs = Math.max(0, Math.round(v)); });
        },

        setEchoCancellation: (enabled: boolean) => {
          set((state) => { state.echoCancellation = enabled; });
        },

        setAutoGainControl: (enabled: boolean) => {
          set((state) => { state.autoGainControl = enabled; });
        },

        setNoiseSuppression: (enabled: boolean) => {
          set((state) => { state.noiseSuppression = enabled; });
        },

        setInputGain: (gain: number) => {
          set((state) => { state.inputGain = Math.min(1, Math.max(0.1, gain)); });
        },

        setCaptureMethod: (method: CaptureMethod) => {
          set((state) => { state.captureMethod = method; });
        },

        setSectionOpen: (section: string, isOpen: boolean) => {
          set((state) => { state.sectionState[section] = isOpen; });
        },

        addRTDataPoint: (result: TranscriptionResult) => {
          set((s) => {
            s.rtHistory.push({
              timestamp: Date.now(),
              rtFactor: result.rt_factor,
              totalMs: result.total_ms,
              tokS: result.tok_s,
            });

            // Keep only last 50 points (rolling window)
            if (s.rtHistory.length > 50) {
              s.rtHistory.shift();
            }
          });
        },

        trackRequestStart: (requestId: string, audioDurationMs: number) => {
          set((s) => {
            // If there are already pending requests, this one is queued
            const wasQueued = s.pendingRequests.length > 0;
            s.pendingRequests.push({
              requestId,
              startTime: Date.now(),
              audioDurationMs,
              wasQueued,
            });
          });
        },

        trackRequestComplete: (requestId: string, result: TranscriptionResult) => {
          set((s) => {
            const endTime = Date.now();
            const pendingIndex = s.pendingRequests.findIndex(r => r.requestId === requestId);

            if (pendingIndex === -1) {
              console.warn(`Request ${requestId} not found in pending requests`);
              return;
            }

            const pending = s.pendingRequests[pendingIndex];
            const e2eMs = endTime - pending.startTime;
            const serverTotalMs = result.total_ms;
            const overheadMs = e2eMs - serverTotalMs;
            const overheadPercent = (overheadMs / e2eMs) * 100;

            // Use server's audio_ms for accurate duration
            const audioDurationMs = result.audio_ms;

            // Add to request history
            s.requestHistory.push({
              requestId,
              timestamp: endTime,
              audioDurationMs,
              serverTotalMs,
              e2eMs,
              overheadMs,
              overheadPercent,
              wasQueued: pending.wasQueued,
            });

            // Keep only last 50 points
            if (s.requestHistory.length > 50) {
              s.requestHistory.shift();
            }

            // Remove from pending
            s.pendingRequests.splice(pendingIndex, 1);
          });
        },

        startRecording: async () => {
          const state = get();
          if (state.isRecording || state.isProcessing) return;

          // VAD mode: the VAD library handles audio capture
          if (state.realtimeMode && state.vadEnabled) {
            set((s) => {
              s.isRecording = true;
              s.transcripts = [];
              s.statusMessage = 'Realtime mode: sending when speech detected. Click to stop.';
            });
            return;
          }

          try {
            const constraints = buildMicrophoneConstraints({
              echoCancellation: state.echoCancellation,
              autoGainControl: state.autoGainControl,
              noiseSuppression: state.noiseSuppression,
            });
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: constraints,
              video: false,
            });

            // Log actual microphone settings for debugging
            const track = stream.getAudioTracks()[0];
            console.log('Requested constraints:', constraints);
            console.log('Actual microphone settings:', track.getSettings());

            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);

            // Create gain node for input level control
            const gainNode = audioContext.createGain();
            gainNode.gain.value = state.inputGain;
            source.connect(gainNode);
            audioResources.gainNode = gainNode;
            console.log(`Input gain set to ${(state.inputGain * 100).toFixed(0)}%`);

            // Clear previous buffers
            audioResources.audioBuffer = [];
            audioResources.recordedBlobs = [];
            audioResources.lastWavBlob = null;

            if (state.captureMethod === 'mediarecorder') {
              // MediaRecorder capture method with WAV encoding
              await ensureWavEncoder();

              // Create a destination stream with gain applied
              const destination = audioContext.createMediaStreamDestination();
              gainNode.connect(destination);

              const mediaRecorder = new ExtMediaRecorder(destination.stream, {
                mimeType: 'audio/wav',
              });

              mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                  audioResources.recordedBlobs.push(event.data);
                }
              };

              mediaRecorder.start();
              audioResources.mediaRecorder = mediaRecorder;
              console.log('Using MediaRecorder with WAV encoding');
            } else {
              // AudioWorklet capture method (default)
              let useWorklet = false;
              if (audioContext.audioWorklet) {
                try {
                  await audioContext.audioWorklet.addModule('/audio-capture-worklet.js');
                  const workletNode = new AudioWorkletNode(audioContext, 'audio-capture-processor');
                  workletNode.port.onmessage = (event) => {
                    if (event.data.type === 'audio') {
                      audioResources.audioBuffer.push(new Float32Array(event.data.buffer));
                    }
                  };
                  gainNode.connect(workletNode);
                  workletNode.connect(audioContext.destination);
                  audioResources.workletNode = workletNode;
                  useWorklet = true;
                  console.log('Using AudioWorklet for audio capture');
                } catch (workletErr) {
                  console.warn('AudioWorklet failed, falling back to ScriptProcessorNode:', workletErr);
                }
              }

              // Fallback to ScriptProcessorNode (deprecated but widely supported)
              if (!useWorklet) {
                const processor = audioContext.createScriptProcessor(4096, 1, 1);
                processor.onaudioprocess = (e) => {
                  const input = e.inputBuffer.getChannelData(0);
                  audioResources.audioBuffer.push(new Float32Array(input));
                };
                gainNode.connect(processor);
                processor.connect(audioContext.destination);
                audioResources.processor = processor;
                console.log('Using ScriptProcessorNode for audio capture (fallback)');
              }
            }

            // Store references
            audioResources.audioContext = audioContext;
            audioResources.mediaStream = stream;

            const currentState = get();

            if (currentState.realtimeMode) {
              // Clear transcripts for new session
              set((s) => {
                s.transcripts = [];
              });

              // Start chunk timer
              const flushChunk = async () => {
                // Skip if finalizing
                if (get().isFinalizing) return;

                const chunks = audioResources.audioBuffer;
                if (chunks.length === 0) return;

                // Capture and reset buffer atomically
                audioResources.audioBuffer = [];
                const nativeRate = audioResources.audioContext?.sampleRate || 48000;

                const requestId = generateRequestId();

                try {
                  const wavBlob = await prepareAudioForTranscription(chunks, nativeRate);
                  const audioDurationMs = getWavDurationMs(wavBlob);

                  set((s) => { s.isProcessing = true; });

                  // Track request start
                  get().trackRequestStart(requestId, audioDurationMs);

                  const result = await transcribe(
                    wavBlob,
                    get().serverUrl,
                    get().language || undefined
                  );

                  // Track request completion
                  get().trackRequestComplete(requestId, result);
                  get().addRTDataPoint(result);

                  const text = result.text?.trim();
                  if (text) {
                    set((s) => {
                      s.transcripts = [...s.transcripts, text];
                      s.transcript = text; // Only show last transcript
                    });
                  }
                } catch (err) {
                  // Remove from pending on error
                  set((s) => {
                    s.pendingRequests = s.pendingRequests.filter(r => r.requestId !== requestId);
                  });
                  console.error('Chunk transcription failed:', err);
                } finally {
                  set((s) => { s.isProcessing = false; });
                }
              };

              audioResources.chunkTimer = window.setInterval(flushChunk, get().chunkInterval * 1000);
            }

            set((s) => {
              s.isRecording = true;
              s.statusMessage = getRecordingStatusMessage({ ...s, isRecording: true });
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Microphone access denied';
            set((s) => {
              s.statusMessage = `Error: ${message}`;
            });
          }
        },

        stopRecording: async () => {
          const state = get();
          if (!state.isRecording) return;

          // VAD mode: no audio resources to clean up
          if (state.realtimeMode && state.vadEnabled) {
            set((s) => {
              s.isRecording = false;
              s.isSpeaking = false;
              if (s.isFinalizing) {
                s.statusMessage = s.isProcessing
                  ? 'Finalizing... Click to abort.'
                  : 'Session ended.';
                // Reset finalizing after processing completes
                if (!s.isProcessing) {
                  s.isFinalizing = false;
                }
              } else {
                s.statusMessage = 'Realtime session ended.';
              }
            });
            return;
          }

          // Clear chunk timer if in realtime mode
          if (audioResources.chunkTimer) {
            clearInterval(audioResources.chunkTimer);
            audioResources.chunkTimer = null;
          }

          const wasRealtime = get().realtimeMode;
          const nativeSampleRate = audioResources.audioContext?.sampleRate || 48000;
          let wavBlob: Blob | null = null;
          let hasAudio = false;

          // Handle MediaRecorder capture method
          if (audioResources.mediaRecorder && audioResources.mediaRecorder.state !== 'inactive') {
            // Stop MediaRecorder and wait for final data
            const recorder = audioResources.mediaRecorder;
            const rawWavBlob = await new Promise<Blob>((resolve) => {
              recorder.onstop = () => {
                const blob = new Blob(audioResources.recordedBlobs, { type: 'audio/wav' });
                resolve(blob);
              };
              recorder.stop();
            });
            hasAudio = rawWavBlob.size > 44; // WAV header is 44 bytes
            audioResources.lastWavBlob = rawWavBlob;
            console.log(`MediaRecorder stopped, WAV size: ${rawWavBlob.size} bytes`);

            // Resample to 16kHz for the server
            if (hasAudio) {
              wavBlob = await resampleWavBlob(rawWavBlob);
              console.log(`Resampled WAV size: ${wavBlob.size} bytes`);
            }
          } else {
            // Handle worklet/ScriptProcessor capture method
            const audioBuffer = [...audioResources.audioBuffer];
            hasAudio = audioBuffer.length > 0;

            // Store for debug downloads
            audioResources.lastRecording = {
              chunks: audioBuffer,
              sampleRate: nativeSampleRate,
            };

            if (hasAudio) {
              wavBlob = await prepareAudioForTranscription(audioBuffer, nativeSampleRate, true);
            }
          }

          // Cleanup audio resources
          audioResources.workletNode?.disconnect();
          audioResources.processor?.disconnect();
          audioResources.gainNode?.disconnect();
          audioResources.mediaStream?.getTracks().forEach(t => t.stop());
          await audioResources.audioContext?.close();

          audioResources.audioContext = null;
          audioResources.mediaStream = null;
          audioResources.gainNode = null;
          audioResources.workletNode = null;
          audioResources.processor = null;
          audioResources.mediaRecorder = null;
          audioResources.audioBuffer = [];
          audioResources.recordedBlobs = [];

          // Clear old preview URLs to avoid stale URL errors
          const oldState = get();
          if (oldState.rawAudioUrl) URL.revokeObjectURL(oldState.rawAudioUrl);
          if (oldState.processedAudioUrl) URL.revokeObjectURL(oldState.processedAudioUrl);

          set((s) => {
            s.isRecording = false;
            s.isProcessing = hasAudio;
            s.hasRecordedAudio = hasAudio;
            s.rawAudioUrl = null;
            s.processedAudioUrl = null;
            if (s.isFinalizing) {
              s.statusMessage = hasAudio
                ? 'Processing final chunk... Click to abort.'
                : 'Finalizing complete.';
            } else {
              s.statusMessage = hasAudio
                ? (wasRealtime ? 'Sending final chunk...' : 'Processing...')
                : (wasRealtime ? 'Realtime session ended.' : 'No audio recorded. Try again.');
            }
          });

          // Prepare audio preview URLs
          if (hasAudio) {
            if (audioResources.lastWavBlob) {
              // MediaRecorder: use WAV blob directly for preview
              const wavUrl = URL.createObjectURL(audioResources.lastWavBlob);
              set((s) => {
                s.rawAudioUrl = wavUrl;
                s.processedAudioUrl = wavUrl; // Same file for both (already WAV)
              });
            } else if (audioResources.lastRecording.chunks.length > 0) {
              // Worklet: prepare preview from chunks
              get().prepareAudioPreview();
            }
          }

          // Send audio for transcription
          if (wavBlob && hasAudio) {
            const requestId = generateRequestId();
            const audioDurationMs = getWavDurationMs(wavBlob);

            // Track request start
            get().trackRequestStart(requestId, audioDurationMs);

            try {
              const currentState = get();
              const result = await transcribe(
                wavBlob,
                currentState.serverUrl,
                currentState.language || undefined
              );

              // Track request completion
              get().trackRequestComplete(requestId, result);
              get().addRTDataPoint(result);

              const text = result.text?.trim() || '';

              set((s) => {
                s.isProcessing = false;
                s.isFinalizing = false;
                if (wasRealtime && text) {
                  s.transcripts = [...s.transcripts, text];
                  s.transcript = s.transcripts.join(' ');
                  s.statusMessage = 'Realtime session ended.';
                } else if (!wasRealtime) {
                  s.transcript = text;
                  if (text) {
                    s.transcripts = [...s.transcripts, text];
                  }
                  s.statusMessage = text
                    ? 'Click the sphere to record again.'
                    : 'No speech detected. Try again.';
                }
              });
            } catch (err) {
              // Remove from pending on error
              set((s) => {
                s.pendingRequests = s.pendingRequests.filter(r => r.requestId !== requestId);
              });
              let message = 'Transcription failed';
              if (err instanceof TypeError && err.message.includes('fetch')) {
                message = 'Server unreachable. Check Settings.';
              } else if (err instanceof Error) {
                message = err.message;
              }
              set((s) => {
                s.isProcessing = false;
                s.isFinalizing = false;
                s.serverStatus = 'error';
                s.statusMessage = `Error: ${message}`;
              });
            }
          }
        },

        abortSession: () => {
          // Clear chunk timer
          if (audioResources.chunkTimer) {
            clearInterval(audioResources.chunkTimer);
            audioResources.chunkTimer = null;
          }

          // Cleanup audio resources immediately
          audioResources.workletNode?.disconnect();
          audioResources.processor?.disconnect();
          audioResources.gainNode?.disconnect();
          audioResources.mediaStream?.getTracks().forEach(t => t.stop());
          audioResources.audioContext?.close().catch(() => {});
          audioResources.mediaRecorder?.stop();

          audioResources.audioContext = null;
          audioResources.mediaStream = null;
          audioResources.gainNode = null;
          audioResources.workletNode = null;
          audioResources.processor = null;
          audioResources.mediaRecorder = null;
          audioResources.audioBuffer = [];
          audioResources.recordedBlobs = [];

          set((s) => {
            s.isRecording = false;
            s.isProcessing = false;
            s.isFinalizing = false;
            s.isSpeaking = false;
            s.statusMessage = 'Session aborted. Click to start again.';
          });
        },

        toggleRecording: () => {
          const state = get();

          // If finalizing: abort everything
          if (state.isFinalizing) {
            get().abortSession();
            return;
          }

          // If recording: enter finalizing state
          if (state.isRecording) {
            set((s) => {
              s.isFinalizing = true;
              s.statusMessage = 'Finalizing... Click again to abort.';
            });
            state.stopRecording();
            return;
          }

          // If idle: start recording normally
          if (!state.isProcessing) {
            state.startRecording();
          }
        },

        prepareAudioPreview: async () => {
          const { chunks, sampleRate } = audioResources.lastRecording;
          if (chunks.length === 0) return;

          // Revoke old URLs to avoid memory leaks
          const state = get();
          if (state.rawAudioUrl) URL.revokeObjectURL(state.rawAudioUrl);
          if (state.processedAudioUrl) URL.revokeObjectURL(state.processedAudioUrl);

          const { raw, processed } = await prepareAudioForDebug(chunks, sampleRate);
          set((s) => {
            s.rawAudioUrl = URL.createObjectURL(raw);
            s.processedAudioUrl = URL.createObjectURL(processed);
          });
        },

        downloadRawAudio: () => {
          const state = get();
          if (!state.rawAudioUrl) {
            console.warn('No recording available to download');
            return;
          }
          const { sampleRate } = audioResources.lastRecording;
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const a = document.createElement('a');
          a.href = state.rawAudioUrl;
          a.download = `raw-${sampleRate}hz-${timestamp}.wav`;
          a.click();
        },

        downloadProcessedAudio: () => {
          const state = get();
          if (!state.processedAudioUrl) {
            console.warn('No recording available to download');
            return;
          }
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const a = document.createElement('a');
          a.href = state.processedAudioUrl;
          a.download = `processed-16000hz-${timestamp}.wav`;
          a.click();
        },
      })),
      {
        name: 'canvas-glow-asr-storage',
        // Only persist settings, not recording state
        partialize: (state) => ({
          serverUrl: state.serverUrl,
          language: state.language,
          systemPrompt: state.systemPrompt,
          normalizeProbes: state.normalizeProbes,
          heroExpanded: state.heroExpanded,
          sectionState: state.sectionState,
          realtimeMode: state.realtimeMode,
          chunkInterval: state.chunkInterval,
          vadEnabled: state.vadEnabled,
          vadSystem: state.vadSystem,
          vadPositiveThreshold: state.vadPositiveThreshold,
          vadNegativeThreshold: state.vadNegativeThreshold,
          vadRedemptionMs: state.vadRedemptionMs,
          vadPreSpeechPadMs: state.vadPreSpeechPadMs,
          vadMinSpeechMs: state.vadMinSpeechMs,
          echoCancellation: state.echoCancellation,
          autoGainControl: state.autoGainControl,
          noiseSuppression: state.noiseSuppression,
          inputGain: state.inputGain,
          captureMethod: state.captureMethod,
        }),
      }
    )
  )
);
