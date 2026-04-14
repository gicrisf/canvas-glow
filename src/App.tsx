import { useRef, useEffect, useCallback } from 'react'
import { useMicVAD } from '@ricky0123/vad-react'
import './App.css'
import { useStore, createGainAdjustedStream } from './Store';
import { encodeWAV, transcribe } from './audio';
import { SettingsPanel } from './components/SettingsPanel';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    isRecording,
    isProcessing,
    transcript,
    statusMessage,
    serverUrl,
    settingsOpen,
    realtimeMode,
    vadEnabled,
    vadSystem,
    vadStatus,
    asrStatus,
    vadPositiveThreshold,
    vadNegativeThreshold,
    vadRedemptionMs,
    vadPreSpeechPadMs,
    vadMinSpeechMs,
    inputGain,
    toggleRecording,
    toggleSettings,
    checkServerHealth,
  } = useStore();

  // VAD integration (only active when silero is selected)
  // getStream changes identity when params change, forcing hook to recreate VAD
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getStream = useCallback(() => createGainAdjustedStream(
    { channelCount: 1, echoCancellation: true, autoGainControl: true, noiseSuppression: true },
    inputGain
  ), [vadPositiveThreshold, vadNegativeThreshold, vadRedemptionMs, vadPreSpeechPadMs, vadMinSpeechMs, inputGain]);

  const vad = useMicVAD({
    baseAssetPath: '/vad/',
    onnxWASMBasePath: '/ort/',
    positiveSpeechThreshold: vadPositiveThreshold,
    negativeSpeechThreshold: vadNegativeThreshold,
    redemptionMs: vadRedemptionMs,
    preSpeechPadMs: vadPreSpeechPadMs,
    minSpeechMs: vadMinSpeechMs,
    getStream,
    onSpeechStart: useCallback(() => {
      if (!isRecording || !realtimeMode || !vadEnabled || vadSystem !== 'silero') return;
      useStore.setState({ vadStatus: 'Speech start detected' });
      useStore.setState({ isProcessing: true });
    }, [isRecording, realtimeMode, vadEnabled, vadSystem]),

    onSpeechRealStart: useCallback(() => {
      if (!isRecording || !realtimeMode || !vadEnabled || vadSystem !== 'silero') return;
      useStore.setState({ vadStatus: 'Speech real start' });
    }, [isRecording, realtimeMode, vadEnabled, vadSystem]),

    onSpeechEnd: useCallback(async (audio: Float32Array) => {
      if (!isRecording || !realtimeMode || !vadEnabled || vadSystem !== 'silero') return;
      useStore.setState({ vadStatus: `Speech end — ${Math.round(audio.length / 16)}ms (min ${useStore.getState().vadMinSpeechMs}ms)` });

      const state = useStore.getState();
      const wavBlob = encodeWAV(audio, 16000);

      try {
        const result = await transcribe(wavBlob, state.serverUrl, state.language || undefined);
        const text = result.text?.trim();
        useStore.setState({
          asrStatus: `${result.total_ms.toFixed(0)}ms, ${result.tok_s.toFixed(1)} tok/s, rt ${result.rt_factor.toFixed(2)}`,
        });
        if (text) {
          useStore.setState({ vadStatus: `Received: "${text}"` });
          useStore.setState({
            transcripts: [...state.transcripts, text],
            transcript: text, // Only show last transcript
          });
        }
      } catch (err) {
        useStore.setState({ vadStatus: `Error: ${err instanceof Error ? err.message : 'unknown'}` });
      } finally {
        useStore.setState({ isProcessing: false });
      }
    }, [isRecording, realtimeMode, vadEnabled, vadSystem]),

    onVADMisfire: useCallback(() => {
      if (!isRecording || !realtimeMode || !vadEnabled || vadSystem !== 'silero') return;
      useStore.setState({ vadStatus: `VAD misfire (min ${useStore.getState().vadMinSpeechMs}ms)` });
    }, [isRecording, realtimeMode, vadEnabled, vadSystem]),
  });

  // Start/pause VAD with recording (only when silero is selected)
  useEffect(() => {
    if (vad.loading || vadSystem !== 'silero') return;
    if (isRecording && realtimeMode && vadEnabled) {
      vad.start();
    } else {
      vad.pause();
    }
  }, [isRecording, realtimeMode, vad, vadEnabled, vadSystem, vad.loading, vad.start, vad.pause]);

  // Refs for animation state (avoids restarting the loop on every change)
  const animState = useRef({ isRecording: false, isProcessing: false, isSpeaking: false });
  animState.current = {
    isRecording,
    isProcessing,
    isSpeaking: realtimeMode && vadEnabled && vad.userSpeaking,
  };

  // Canvas rendering — runs once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error("Canvas ctx not found!");
    }

    let frameCount = 0;
    let animationId: number;

    const draw = () => {
      const { width, height } = canvas;
      const { isRecording, isProcessing, isSpeaking } = animState.current;

      // Clear
      ctx.clearRect(0, 0, width, height);

      if (!isRecording && !isProcessing) {
        // Grey static circle when idle
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'grey';
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 100, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Pulsing sphere when recording or processing
        ctx.shadowBlur = 20;

        // Cyan when speaking, purple when processing, pink when recording
        const color = isSpeaking
          ? { r: 0, g: 255, b: 255 }   // Cyan when VAD detects speech
          : isProcessing
            ? { r: 147, g: 112, b: 219 } // Medium purple
            : { r: 255, g: 105, b: 180 }; // Hot pink

        ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`;

        const gradient = ctx.createRadialGradient(
          width / 2 + Math.sin(frameCount * 0.05) * 50,
          height / 2 + Math.cos(frameCount * 0.05) * 50,
          0,
          width / 2 + Math.sin(frameCount * 0.05) * 50,
          height / 2 + Math.cos(frameCount * 0.05) * 50,
          100
        );
        gradient.addColorStop(0, 'white');
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        const radius = 100 + 20 * Math.sin(frameCount * 0.05);
        ctx.arc(
          width / 2 + Math.sin(frameCount * 0.05) * 50,
          height / 2 + Math.cos(frameCount * 0.05) * 50,
          radius, 0, Math.PI * 2
        );
        ctx.fill();

        frameCount++;
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  // Click handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleClick = (event: MouseEvent) => {
      if (event.button === 0) {
        toggleRecording();
      }
    };

    canvas.addEventListener('mousedown', handleClick);
    return () => {
      canvas.removeEventListener('mousedown', handleClick);
    };
  }, [toggleRecording]);

  // Check server health on mount and when URL changes
  useEffect(() => {
    checkServerHealth();
  }, [serverUrl, checkServerHealth]);

  return (
    <div>
      <h1>I heard the canvas glow</h1>
      <h3>&gt; {statusMessage}</h3>
      {realtimeMode && vadEnabled && vadSystem === 'silero' && vad.loading && (
        <h3 style={{ color: '#fbbf24' }}>&gt; Loading Silero VAD model...</h3>
      )}
      {realtimeMode && vadEnabled && vadSystem !== 'silero' && (
        <h3 style={{ color: '#f87171' }}>&gt; VAD system "{vadSystem}" not yet implemented</h3>
      )}
      {realtimeMode && vadEnabled && vadStatus && (
        <h3 style={{ color: '#9ca3af' }}>&gt; {vadStatus}</h3>
      )}
      {asrStatus && (
        <h3 style={{ color: '#c084fc' }}>&gt; ASR: {asrStatus}</h3>
      )}
      <canvas
        ref={canvasRef}
        width="800"
        height="600"
        style={{ cursor: isProcessing ? 'wait' : 'pointer' }}
      />

      {transcript && (
        <div style={{ marginTop: '1rem', maxWidth: '800px' }}>
          <h3>Transcript:</h3>
          <p style={{ fontSize: '1.2rem', lineHeight: 1.6 }}>{transcript}</p>
        </div>
      )}

      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button onClick={toggleSettings}>
          {settingsOpen ? '− Settings' : '+ Settings'}
        </button>

        {settingsOpen && <SettingsPanel />}
      </div>
    </div>
  )
}

export default App
