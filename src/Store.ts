import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools, persist } from 'zustand/middleware';
import { prepareAudioForTranscription, transcribe } from './audio';

// Audio resources kept outside Immer (mutable)
const audioResources = {
  audioContext: null as AudioContext | null,
  mediaStream: null as MediaStream | null,
  processor: null as ScriptProcessorNode | null,
  audioBuffer: [] as Float32Array[],
};

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
}

type Actions = {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  toggleRecording: () => void;
  setServerUrl: (url: string) => void;
  setLanguage: (lang: string) => void;
  toggleSettings: () => void;
  setStatusMessage: (msg: string) => void;
  checkServerHealth: () => Promise<void>;
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

        startRecording: async () => {
          const state = get();
          if (state.isRecording || state.isProcessing) return;

          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });

            const audioContext = new AudioContext();
            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            // Clear previous buffer
            audioResources.audioBuffer = [];

            processor.onaudioprocess = (e) => {
              const input = e.inputBuffer.getChannelData(0);
              audioResources.audioBuffer.push(new Float32Array(input));
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            // Store references
            audioResources.audioContext = audioContext;
            audioResources.mediaStream = stream;
            audioResources.processor = processor;

            set((s) => {
              s.isRecording = true;
              s.statusMessage = 'Recording... Click to stop.';
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

          // Capture audio state before cleanup
          const audioBuffer = audioResources.audioBuffer;
          const nativeSampleRate = audioResources.audioContext?.sampleRate || 48000;

          // Cleanup audio resources
          audioResources.processor?.disconnect();
          audioResources.mediaStream?.getTracks().forEach(t => t.stop());
          await audioResources.audioContext?.close();

          audioResources.audioContext = null;
          audioResources.mediaStream = null;
          audioResources.processor = null;
          audioResources.audioBuffer = [];

          set((s) => {
            s.isRecording = false;
            s.isProcessing = true;
            s.statusMessage = 'Processing...';
          });

          // Process and send audio
          if (audioBuffer.length > 0) {
            try {
              const wavBlob = prepareAudioForTranscription(audioBuffer, nativeSampleRate);
              const currentState = get();
              const result = await transcribe(
                wavBlob,
                currentState.serverUrl,
                currentState.language || undefined
              );

              set((s) => {
                s.isProcessing = false;
                s.transcript = result.text?.trim() || '';
                s.statusMessage = result.text?.trim()
                  ? 'Click the sphere to record again.'
                  : 'No speech detected. Try again.';
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
          } else {
            set((s) => {
              s.isProcessing = false;
              s.statusMessage = 'No audio recorded. Try again.';
            });
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
      })),
      {
        name: 'canvas-glow-asr-storage',
        // Only persist settings, not recording state
        partialize: (state) => ({
          serverUrl: state.serverUrl,
          language: state.language,
        }),
      }
    )
  )
);
