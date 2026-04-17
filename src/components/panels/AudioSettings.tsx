import { useStore, type CaptureMethod } from '../../Store';

export function AudioSettings() {
  const {
    realtimeMode,
    chunkInterval,
    vadEnabled,
    echoCancellation,
    autoGainControl,
    noiseSuppression,
    inputGain,
    captureMethod,
    hasRecordedAudio,
    rawAudioUrl,
    processedAudioUrl,
    toggleRealtime,
    setChunkInterval,
    setEchoCancellation,
    setAutoGainControl,
    setNoiseSuppression,
    setInputGain,
    setCaptureMethod,
    downloadRawAudio,
    downloadProcessedAudio,
  } = useStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={toggleRealtime}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: realtimeMode ? '#4ade80' : 'transparent',
            color: realtimeMode ? '#000' : 'inherit',
            border: '1px solid',
            borderColor: realtimeMode ? '#4ade80' : '#666',
            cursor: 'pointer',
          }}
        >
          Realtime: {realtimeMode ? 'ON' : 'OFF'}
        </button>

        {realtimeMode && !vadEnabled && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Chunk:
            <input
              type="number"
              min={1}
              value={chunkInterval}
              onChange={(e) => setChunkInterval(Number(e.target.value))}
              style={{ width: '3.5rem', padding: '0.25rem', textAlign: 'center' }}
            />
            s
          </label>
        )}
      </div>

      {/* Browser Audio Processing Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Browser Audio Processing:</span>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={echoCancellation}
              onChange={(e) => setEchoCancellation(e.target.checked)}
            />
            Echo Cancel
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoGainControl}
              onChange={(e) => setAutoGainControl(e.target.checked)}
            />
            Auto Gain
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={noiseSuppression}
              onChange={(e) => setNoiseSuppression(e.target.checked)}
            />
            Noise Suppress
          </label>
        </div>
      </div>

      {/* Input Gain Control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <label style={{ minWidth: '80px' }}>Input Gain:</label>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={inputGain}
          onChange={(e) => setInputGain(Number(e.target.value))}
          style={{ flex: 1, maxWidth: '150px' }}
        />
        <span style={{ fontSize: '0.75rem', color: '#9ca3af', minWidth: '40px' }}>
          {(inputGain * 100).toFixed(0)}%
        </span>
      </div>

      {/* Capture Method Selection */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <label style={{ minWidth: '80px' }}>Capture:</label>
        <select
          value={captureMethod}
          onChange={(e) => setCaptureMethod(e.target.value as CaptureMethod)}
          style={{ padding: '0.25rem 0.5rem' }}
        >
          <option value="worklet">AudioWorklet</option>
          <option value="mediarecorder">MediaRecorder (WAV)</option>
        </select>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          {captureMethod === 'worklet' ? 'Low latency' : 'Better quality'}
        </span>
      </div>

      {/* Audio Preview & Download Section */}
      <div style={{
        borderTop: '1px solid #333',
        paddingTop: '0.75rem',
        opacity: hasRecordedAudio ? 1 : 0.4,
      }}>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
          Last Recording Preview
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* Raw Audio */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', minWidth: '70px' }}>Raw:</span>
            <audio
              src={rawAudioUrl || undefined}
              controls
              style={{ height: '32px', flex: 1 }}
            />
            <button
              onClick={downloadRawAudio}
              disabled={!hasRecordedAudio}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                cursor: hasRecordedAudio ? 'pointer' : 'not-allowed',
              }}
            >
              ↓
            </button>
          </div>

          {/* Processed Audio */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', minWidth: '70px' }}>16kHz:</span>
            <audio
              src={processedAudioUrl || undefined}
              controls
              style={{ height: '32px', flex: 1 }}
            />
            <button
              onClick={downloadProcessedAudio}
              disabled={!hasRecordedAudio}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                cursor: hasRecordedAudio ? 'pointer' : 'not-allowed',
              }}
            >
              ↓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
