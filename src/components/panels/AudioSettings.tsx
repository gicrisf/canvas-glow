import { useStore, type CaptureMethod } from '../../Store';
import { CustomAudioPlayer } from './CustomAudioPlayer';
import './FormControls.css';

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
    <div className="form-stack">
      {/* Row 1: Realtime Toggle + Chunk + Capture Method */}
      <div className="form-row-wrap">
        <button
          onClick={toggleRealtime}
          className={`form-button form-button-toggle ${realtimeMode ? 'active' : ''}`}
        >
          Realtime: {realtimeMode ? 'ON' : 'OFF'}
        </button>

        {realtimeMode && !vadEnabled && (
          <label className="form-label">
            Chunk:
            <input
              type="number"
              min={1}
              value={chunkInterval}
              onChange={(e) => setChunkInterval(Number(e.target.value))}
              className="form-input form-input-narrow"
            />
            s
          </label>
        )}

        <span className="form-separator">•</span>
        <select
          value={captureMethod}
          onChange={(e) => setCaptureMethod(e.target.value as CaptureMethod)}
          className="form-select"
        >
          <option value="worklet">AudioWorklet</option>
          <option value="mediarecorder">MediaRecorder (WAV)</option>
        </select>
      </div>

      {/* Browser Audio Processing Controls */}
      <div className="form-stack">
        <span className="form-group-label">Browser Audio Processing:</span>
        <div className="form-checkbox-group">
          <label className="form-label">
            <input
              type="checkbox"
              checked={echoCancellation}
              onChange={(e) => setEchoCancellation(e.target.checked)}
            />
            Echo Cancel
          </label>
          <label className="form-label">
            <input
              type="checkbox"
              checked={autoGainControl}
              onChange={(e) => setAutoGainControl(e.target.checked)}
            />
            Auto Gain
          </label>
          <label className="form-label">
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
      <div className="form-input-row">
        <label className="form-input-label">Input Gain</label>
        <input
          type="number"
          min={10}
          max={100}
          step={5}
          value={Math.round(inputGain * 100)}
          onChange={(e) => setInputGain(Number(e.target.value) / 100)}
          className="form-input form-input-number"
        />
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={inputGain}
          onChange={(e) => setInputGain(Number(e.target.value))}
          className="form-range"
        />
      </div>

      {/* Audio Preview & Download Section */}
      <div className={`form-divider ${hasRecordedAudio ? '' : 'form-section-disabled'}`}>
        <div className="form-group-label">Last Recording Preview</div>

        <div className="form-stack">
          {/* Raw Audio */}
          <div className="form-slider-row">
            <label className="form-slider-label">Raw</label>
            <CustomAudioPlayer src={rawAudioUrl || undefined} />
            <button
              onClick={downloadRawAudio}
              disabled={!hasRecordedAudio}
              className="form-button"
            >
              Download ↓
            </button>
          </div>

          {/* Processed Audio */}
          <div className="form-slider-row">
            <label className="form-slider-label">16kHz</label>
            <CustomAudioPlayer src={processedAudioUrl || undefined} />
            <button
              onClick={downloadProcessedAudio}
              disabled={!hasRecordedAudio}
              className="form-button"
            >
              Download ↓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
