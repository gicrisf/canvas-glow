import { useStore } from '../../Store';
import { VAD_SYSTEMS } from '../../audio';
import './FormControls.css';

export function VADSettings() {
  const {
    realtimeMode,
    vadEnabled,
    vadSystem,
    vadPositiveThreshold,
    vadNegativeThreshold,
    vadRedemptionMs,
    vadPreSpeechPadMs,
    vadMinSpeechMs,
    toggleVad,
    setVadSystem,
    setVadPositiveThreshold,
    setVadNegativeThreshold,
    setVadRedemptionMs,
    setVadPreSpeechPadMs,
    setVadMinSpeechMs,
  } = useStore();

  return (
    <div className="form-stack">
      {/* Row 1: VAD Toggle + System Selector */}
      <div className="form-row">
        <button
          onClick={toggleVad}
          disabled={!realtimeMode}
          className={`form-button form-button-toggle ${vadEnabled && realtimeMode ? 'active' : ''} ${!realtimeMode ? 'form-section-disabled' : ''}`}
        >
          VAD: {vadEnabled && realtimeMode ? 'ON' : 'OFF'}
        </button>

        {realtimeMode && vadEnabled && (
          <>
            <span className="form-separator">•</span>
            <select
              value={vadSystem}
              onChange={(e) => setVadSystem(e.target.value)}
              className="form-select"
            >
              {VAD_SYSTEMS.map((sys) => (
                <option key={sys} value={sys}>
                  {sys}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {!realtimeMode && (
        <p className="form-hint" style={{ margin: 0 }}>
          Enable Realtime mode to use VAD
        </p>
      )}

      {/* Row 2: Silero VAD Settings */}
      {realtimeMode && vadEnabled && vadSystem === 'silero' && (
        <div className="form-stack">
          {/* Thresholds Group */}
          <div className="form-group">
            <span className="form-group-label">Thresholds:</span>

            <div className="form-input-row">
              <label className="form-input-label">Positive</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={vadPositiveThreshold}
                onChange={(e) => setVadPositiveThreshold(Number(e.target.value))}
                className="form-input form-input-number"
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={vadPositiveThreshold}
                onChange={(e) => setVadPositiveThreshold(Number(e.target.value))}
                className="form-range"
              />
            </div>

            <div className="form-input-row">
              <label className="form-input-label">Negative</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={vadNegativeThreshold}
                onChange={(e) => setVadNegativeThreshold(Number(e.target.value))}
                className="form-input form-input-number"
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={vadNegativeThreshold}
                onChange={(e) => setVadNegativeThreshold(Number(e.target.value))}
                className="form-range"
              />
            </div>
          </div>

          {/* Timing Group */}
          <div className="form-group">
            <span className="form-group-label">Timing (ms):</span>

            <div className="form-input-row">
              <label className="form-input-label">Redemption</label>
              <input
                type="number"
                min={0}
                step={100}
                value={vadRedemptionMs}
                onChange={(e) => setVadRedemptionMs(Number(e.target.value))}
                className="form-input form-input-number"
              />
            </div>

            <div className="form-input-row">
              <label className="form-input-label">Pre-speech</label>
              <input
                type="number"
                min={0}
                step={100}
                value={vadPreSpeechPadMs}
                onChange={(e) => setVadPreSpeechPadMs(Number(e.target.value))}
                className="form-input form-input-number"
              />
            </div>

            <div className="form-input-row">
              <label className="form-input-label">Min speech</label>
              <input
                type="number"
                min={0}
                step={100}
                value={vadMinSpeechMs}
                onChange={(e) => setVadMinSpeechMs(Number(e.target.value))}
                className="form-input form-input-number"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
