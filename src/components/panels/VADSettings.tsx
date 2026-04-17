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
      <div className="form-row">
        <button
          onClick={toggleVad}
          disabled={!realtimeMode}
          className={`form-button form-button-toggle ${vadEnabled && realtimeMode ? 'active' : ''} ${!realtimeMode ? 'form-section-disabled' : ''}`}
        >
          VAD: {vadEnabled && realtimeMode ? 'ON' : 'OFF'}
        </button>
        {realtimeMode && vadEnabled && (
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
        )}
      </div>

      {!realtimeMode && (
        <p className="form-hint" style={{ margin: 0 }}>
          Enable Realtime mode to use VAD
        </p>
      )}

      {realtimeMode && vadEnabled && (
        <div className="form-grid-2col">
          <label className="form-label">
            Positive:
            <input type="number" min={0} max={1} step={0.05}
              value={vadPositiveThreshold}
              onChange={(e) => setVadPositiveThreshold(Number(e.target.value))}
              className="form-input form-input-number"
            />
          </label>
          <label className="form-label">
            Negative:
            <input type="number" min={0} max={1} step={0.05}
              value={vadNegativeThreshold}
              onChange={(e) => setVadNegativeThreshold(Number(e.target.value))}
              className="form-input form-input-number"
            />
          </label>
          <label className="form-label">
            Redemption:
            <input type="number" min={0} step={100}
              value={vadRedemptionMs}
              onChange={(e) => setVadRedemptionMs(Number(e.target.value))}
              className="form-input form-input-number"
            />ms
          </label>
          <label className="form-label">
            Pre-speech:
            <input type="number" min={0} step={100}
              value={vadPreSpeechPadMs}
              onChange={(e) => setVadPreSpeechPadMs(Number(e.target.value))}
              className="form-input form-input-number"
            />ms
          </label>
          <label className="form-label">
            Min speech:
            <input type="number" min={0} step={100}
              value={vadMinSpeechMs}
              onChange={(e) => setVadMinSpeechMs(Number(e.target.value))}
              className="form-input form-input-number"
            />ms
          </label>
        </div>
      )}
    </div>
  );
}
