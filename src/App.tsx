import { useRef, useEffect, useCallback } from 'react'
import { useMicVAD } from '@ricky0123/vad-react'
import './App.css'
import { useStore, createGainAdjustedStream } from './Store';
import { encodeWAV, transcribe, generateRequestId } from './audio';

// Layout components
import { Layout, Navbar, Hero, Columns, Column, Footer } from './components/layout';

// Panel components
import { ASRPanel } from './components/panels/ASRPanel';
import { AudioPanel } from './components/panels/AudioPanel';
import { VADPanel } from './components/panels/VADPanel';
import { AnalyticsPanel, TranscriptPanel, LatencyPanel } from './components/panels';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    isRecording,
    isProcessing,
    isFinalizing,
    statusMessage,
    serverUrl,
    realtimeMode,
    vadEnabled,
    vadSystem,
    vadPositiveThreshold,
    vadNegativeThreshold,
    vadRedemptionMs,
    vadPreSpeechPadMs,
    vadMinSpeechMs,
    inputGain,
    toggleRecording,
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
      useStore.setState({ vadStatus: 'Speech start detected', isSpeaking: true });
      useStore.setState({ isProcessing: true });
    }, [isRecording, realtimeMode, vadEnabled, vadSystem]),

    onSpeechRealStart: useCallback(() => {
      if (!isRecording || !realtimeMode || !vadEnabled || vadSystem !== 'silero') return;
      useStore.setState({ vadStatus: 'Speech real start', isSpeaking: true });
    }, [isRecording, realtimeMode, vadEnabled, vadSystem]),

    onSpeechEnd: useCallback(async (audio: Float32Array) => {
      if (!isRecording || !realtimeMode || !vadEnabled || vadSystem !== 'silero') return;

      const state = useStore.getState();
      // Skip if finalizing
      if (state.isFinalizing) {
        useStore.setState({ vadStatus: 'Speech detected but finalizing (skipped)', isSpeaking: false });
        return;
      }

      const audioDurationMs = (audio.length / 16000) * 1000; // 16kHz sample rate
      useStore.setState({
        vadStatus: `Speech end — ${Math.round(audioDurationMs)}ms (min ${state.vadMinSpeechMs}ms)`,
        isSpeaking: false,
      });

      const wavBlob = encodeWAV(audio, 16000);
      const requestId = generateRequestId();

      // Track request start
      useStore.getState().trackRequestStart(requestId, audioDurationMs);

      try {
        const result = await transcribe(wavBlob, state.serverUrl, state.language || undefined);
        const text = result.text?.trim();

        // Track request completion (includes E2E metrics)
        useStore.getState().trackRequestComplete(requestId, result);
        useStore.getState().addRTDataPoint(result);

        useStore.setState({
          asrStatus: `${result.total_ms.toFixed(0)}ms, ${result.tok_s.toFixed(1)} tok/s, rt ${result.rt_factor.toFixed(2)}`,
        });
        if (text) {
          useStore.setState({
            transcripts: [...state.transcripts, text],
            transcript: text, // Only show last transcript
            statusMessage: `Transcribed: "${text}"`,
          });
        } else {
          useStore.setState({
            statusMessage: 'No speech detected in segment.',
          });
        }
      } catch (err) {
        // Remove from pending on error
        useStore.setState((s) => ({
          pendingRequests: s.pendingRequests.filter(r => r.requestId !== requestId),
        }));
        useStore.setState({
          statusMessage: `Transcription error: ${err instanceof Error ? err.message : 'unknown'}`,
        });
      } finally {
        useStore.setState({ isProcessing: false });
      }
    }, [isRecording, realtimeMode, vadEnabled, vadSystem]),

    onVADMisfire: useCallback(() => {
      if (!isRecording || !realtimeMode || !vadEnabled || vadSystem !== 'silero') return;
      useStore.setState({ vadStatus: `VAD misfire (min ${useStore.getState().vadMinSpeechMs}ms)`, isSpeaking: false });
    }, [isRecording, realtimeMode, vadEnabled, vadSystem]),
  });

  // Sync VAD loading state to store
  useEffect(() => {
    useStore.setState({ vadLoading: vad.loading });
  }, [vad.loading]);

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
  const animState = useRef({ isRecording: false, isProcessing: false, isFinalizing: false, isSpeaking: false });
  animState.current = {
    isRecording,
    isProcessing,
    isFinalizing,
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
      const { isRecording, isProcessing, isFinalizing, isSpeaking } = animState.current;

      // Clear
      ctx.clearRect(0, 0, width, height);

      if (!isRecording && !isProcessing && !isFinalizing) {
        // Grey static circle when idle
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'grey';
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 35, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Pulsing circle when recording, processing, or finalizing (no movement, just pulse)
        ctx.shadowBlur = 15;

        // Orange when finalizing, cyan when speaking, purple when processing, pink when recording
        const color = isFinalizing
          ? { r: 255, g: 165, b: 0 }   // Orange when finalizing
          : isSpeaking
            ? { r: 0, g: 255, b: 255 }   // Cyan when VAD detects speech
            : isProcessing
              ? { r: 147, g: 112, b: 219 } // Medium purple
              : { r: 255, g: 105, b: 180 }; // Hot pink

        ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.8)`;

        const gradient = ctx.createRadialGradient(
          width / 2,
          height / 2,
          0,
          width / 2,
          height / 2,
          35
        );
        gradient.addColorStop(0, 'white');
        gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        const radius = 35 + 8 * Math.sin(frameCount * 0.05);
        ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
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
    <Layout>
      <Navbar />

      <Hero>
        <div className="hero-canvas">
          <canvas
            ref={canvasRef}
            width="150"
            height="100"
            style={{ cursor: 'pointer' }}
          />
        </div>
      </Hero>

      <Columns>
        <Column>
          <ASRPanel />
          <AudioPanel />
        </Column>
        <Column>
          <VADPanel />
          <AnalyticsPanel />
          <LatencyPanel />
          <TranscriptPanel />
        </Column>
      </Columns>

      <Footer>
        <p>&gt; {statusMessage}</p>
      </Footer>
    </Layout>
  )
}

export default App
