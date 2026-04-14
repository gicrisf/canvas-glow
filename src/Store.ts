import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools, persist } from 'zustand/middleware';
import { prepareAudioForTranscription, prepareAudioForDebug, transcribe } from './audio';

// Audio resources kept outside Immer (mutable)
const audioResources = {
  audioContext: null as AudioContext | null,
  mediaStream: null as MediaStream | null,
  gainNode: null as GainNode | null,
  workletNode: null as AudioWorkletNode | null,
  // Fallback for browsers without AudioWorklet support
  processor: null as ScriptProcessorNode | null,
  audioBuffer: [] as Float32Array[],
  chunkTimer: null as number | null,
  // Store last recording for debug downloads
  lastRecording: {
    chunks: [] as Float32Array[],
    sampleRate: 0,
  },
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

// Build microphone constraints based on settings
function buildMicrophoneConstraints(disableProcessing: boolean): MediaTrackConstraints {
  return {
    channelCount: 1,
    sampleRate: { ideal: 48000 },
    echoCancellation: !disableProcessing,
    autoGainControl: !disableProcessing,
    noiseSuppression: !disableProcessing,
  };
}

const DEFAULT_CHUNK_INTERVAL = 5;

type ServerStatus = 'unknown' | 'ok' | 'loading' | 'error';

type State = {
  // Recording state
  isRecording: boolean;
  isProcessing: boolean;
  transcript: string;
  statusMessage: string;
  serverStatus: ServerStatus;

  // Settings (persisted)
  serverUrl: string;
  language: string;
  settingsOpen: boolean;
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
  rawMicMode: boolean; // Disable browser audio processing (AGC, noise suppression, echo cancellation)
  inputGain: number; // Input gain multiplier (0.1 to 1.0)

  // Realtime transcripts
  transcripts: string[];

  // VAD status
  vadStatus: string;

  // ASR status
  asrStatus: string;

  // Debug: audio preview and download
  hasRecordedAudio: boolean;
  rawAudioUrl: string | null;
  processedAudioUrl: string | null;
}

type Actions = {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  toggleRecording: () => void;
  setServerUrl: (url: string) => void;
  setLanguage: (lang: string) => void;
  toggleSettings: () => void;
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
  toggleRawMicMode: () => void;
  setInputGain: (gain: number) => void;
  prepareAudioPreview: () => Promise<void>;
}

export const useStore = create<State & Actions>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Initial state
        isRecording: false,
        isProcessing: false,
        transcript: '',
        statusMessage: 'Click the sphere to start recording.',
        serverStatus: 'unknown' as ServerStatus,
        serverUrl: 'http://localhost:8080',
        language: 'English',
        settingsOpen: false,
        realtimeMode: false,
        chunkInterval: DEFAULT_CHUNK_INTERVAL,
        vadEnabled: false,
        vadSystem: 'silero',
        vadPositiveThreshold: 0.5,
        vadNegativeThreshold: 0.35,
        vadRedemptionMs: 800,
        vadPreSpeechPadMs: 500,
        vadMinSpeechMs: 250,
        rawMicMode: false,
        inputGain: 0.5,
        transcripts: [],
        vadStatus: '',
        asrStatus: '',
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

        toggleSettings: () => {
          set((state) => {
            state.settingsOpen = !state.settingsOpen;
          });
        },

        toggleRealtime: () => {
          set((state) => {
            state.realtimeMode = !state.realtimeMode;
          });
        },

        setChunkInterval: (seconds: number) => {
          const n = Math.max(1, Math.round(seconds));
          set((state) => {
            state.chunkInterval = n;
          });
        },

        toggleVad: () => {
          set((state) => {
            state.vadEnabled = !state.vadEnabled;
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

        toggleRawMicMode: () => {
          set((state) => { state.rawMicMode = !state.rawMicMode; });
        },

        setInputGain: (gain: number) => {
          set((state) => { state.inputGain = Math.min(1, Math.max(0.1, gain)); });
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
            const constraints = buildMicrophoneConstraints(state.rawMicMode);
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

            // Clear previous buffer
            audioResources.audioBuffer = [];

            // Try AudioWorklet first (modern, runs on audio thread)
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
                const chunks = audioResources.audioBuffer;
                if (chunks.length === 0) return;

                // Capture and reset buffer atomically
                audioResources.audioBuffer = [];
                const nativeRate = audioResources.audioContext?.sampleRate || 48000;

                try {
                  const wavBlob = await prepareAudioForTranscription(chunks, nativeRate);
                  set((s) => { s.isProcessing = true; });

                  const result = await transcribe(
                    wavBlob,
                    get().serverUrl,
                    get().language || undefined
                  );

                  const text = result.text?.trim();
                  if (text) {
                    set((s) => {
                      s.transcripts = [...s.transcripts, text];
                      s.transcript = text; // Only show last transcript
                    });
                  }
                } catch (err) {
                  console.error('Chunk transcription failed:', err);
                } finally {
                  set((s) => { s.isProcessing = false; });
                }
              };

              audioResources.chunkTimer = window.setInterval(flushChunk, get().chunkInterval * 1000);
            }

            set((s) => {
              s.isRecording = true;
              s.statusMessage = currentState.realtimeMode
                ? (get().vadEnabled
                  ? 'Realtime mode: sending when speech detected. Click to stop.'
                  : `Realtime mode: streaming every ${get().chunkInterval}s. Click to stop.`)
                : 'Recording... Click to stop.';
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
              s.statusMessage = 'Realtime session ended.';
            });
            return;
          }

          // Clear chunk timer if in realtime mode
          if (audioResources.chunkTimer) {
            clearInterval(audioResources.chunkTimer);
            audioResources.chunkTimer = null;
          }

          // Capture audio state before cleanup
          const audioBuffer = [...audioResources.audioBuffer]; // Copy for debug downloads
          const nativeSampleRate = audioResources.audioContext?.sampleRate || 48000;

          // Store for debug downloads
          audioResources.lastRecording = {
            chunks: audioBuffer,
            sampleRate: nativeSampleRate,
          };

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
          audioResources.audioBuffer = [];

          const wasRealtime = get().realtimeMode;

          set((s) => {
            s.isRecording = false;
            s.isProcessing = audioBuffer.length > 0;
            s.hasRecordedAudio = audioBuffer.length > 0;
            s.statusMessage = audioBuffer.length > 0
              ? (wasRealtime ? 'Sending final chunk...' : 'Processing...')
              : (wasRealtime ? 'Realtime session ended.' : 'No audio recorded. Try again.');
          });

          // Prepare audio preview URLs (non-blocking)
          if (audioBuffer.length > 0) {
            get().prepareAudioPreview();
          }

          // Send remaining audio
          if (audioBuffer.length > 0) {
            try {
              const wavBlob = await prepareAudioForTranscription(audioBuffer, nativeSampleRate, true);
              const currentState = get();
              const result = await transcribe(
                wavBlob,
                currentState.serverUrl,
                currentState.language || undefined
              );

              const text = result.text?.trim() || '';

              set((s) => {
                s.isProcessing = false;
                if (wasRealtime && text) {
                  s.transcripts = [...s.transcripts, text];
                  s.transcript = s.transcripts.join(' ');
                  s.statusMessage = 'Realtime session ended.';
                } else if (!wasRealtime) {
                  s.transcript = text; // Only show last transcript for non-realtime too
                  s.statusMessage = text
                    ? 'Click the sphere to record again.'
                    : 'No speech detected. Try again.';
                }
              });
            } catch (err) {
              let message = 'Transcription failed';
              if (err instanceof TypeError && err.message.includes('fetch')) {
                message = 'Server unreachable. Check Settings.';
              } else if (err instanceof Error) {
                message = err.message;
              }
              set((s) => {
                s.isProcessing = false;
                s.serverStatus = 'error';
                s.statusMessage = `Error: ${message}`;
              });
            }
          }
        },

        toggleRecording: () => {
          const state = get();
          if (state.isProcessing) return; // Ignore clicks while processing

          if (state.isRecording) {
            state.stopRecording();
          } else {
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
          realtimeMode: state.realtimeMode,
          chunkInterval: state.chunkInterval,
          vadEnabled: state.vadEnabled,
          vadSystem: state.vadSystem,
          vadPositiveThreshold: state.vadPositiveThreshold,
          vadNegativeThreshold: state.vadNegativeThreshold,
          vadRedemptionMs: state.vadRedemptionMs,
          vadPreSpeechPadMs: state.vadPreSpeechPadMs,
          vadMinSpeechMs: state.vadMinSpeechMs,
          rawMicMode: state.rawMicMode,
          inputGain: state.inputGain,
        }),
      }
    )
  )
);
