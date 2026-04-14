import { useRef, useEffect } from 'react'
import './App.css'
import { useStore } from './Store';
import { LANGUAGES } from './audio';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    isRecording,
    isProcessing,
    transcript,
    statusMessage,
    serverStatus,
    serverUrl,
    language,
    settingsOpen,
    toggleRecording,
    setServerUrl,
    setLanguage,
    toggleSettings,
    checkServerHealth,
  } = useStore();

  // Canvas rendering
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

        // Pink for recording, purple for processing
        const color = isRecording
          ? { r: 255, g: 105, b: 180 } // Hot pink
          : { r: 147, g: 112, b: 219 }; // Medium purple

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
  }, [isRecording, isProcessing]);

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
      <h1>I saw the canvas glow</h1>
      <h3>&gt; {statusMessage}</h3>
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
          {settingsOpen ? '- Settings' : '+ Settings'}
        </button>

        {settingsOpen && (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%', maxWidth: '400px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Server URL:
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:8080"
                style={{ flex: 1, padding: '0.25rem' }}
              />
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Server Status:</span>
              <span style={{
                color: serverStatus === 'ok' ? '#4ade80' :
                       serverStatus === 'error' ? '#f87171' :
                       serverStatus === 'loading' ? '#fbbf24' : '#9ca3af'
              }}>
                {serverStatus}
              </span>
              <button onClick={checkServerHealth} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
                Check
              </button>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Language:
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                style={{ flex: 1, padding: '0.25rem' }}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang || 'Auto-detect'}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
