import { useStore } from '../../Store';
import { VAD_SYSTEMS } from '../../audio';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={toggleVad}
          disabled={!realtimeMode}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: vadEnabled && realtimeMode ? '#60a5fa' : 'transparent',
            color: vadEnabled && realtimeMode ? '#000' : 'inherit',
            border: '1px solid',
            borderColor: !realtimeMode ? '#444' : vadEnabled ? '#60a5fa' : '#666',
            opacity: realtimeMode ? 1 : 0.4,
            cursor: realtimeMode ? 'pointer' : 'not-allowed',
          }}
        >
          VAD: {vadEnabled && realtimeMode ? 'ON' : 'OFF'}
        </button>
        {realtimeMode && vadEnabled && (
          <select
            value={vadSystem}
            onChange={(e) => setVadSystem(e.target.value)}
            style={{ padding: '0.25rem' }}
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
        <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: 0 }}>
          Enable Realtime mode to use VAD
        </p>
      )}

      {realtimeMode && vadEnabled && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1rem', fontSize: '0.875rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Positive:
            <input type="number" min={0} max={1} step={0.05}
              value={vadPositiveThreshold}
              onChange={(e) => setVadPositiveThreshold(Number(e.target.value))}
              style={{ width: '4rem', padding: '0.2rem', textAlign: 'center' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Negative:
            <input type="number" min={0} max={1} step={0.05}
              value={vadNegativeThreshold}
              onChange={(e) => setVadNegativeThreshold(Number(e.target.value))}
              style={{ width: '4rem', padding: '0.2rem', textAlign: 'center' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Redemption:
            <input type="number" min={0} step={100}
              value={vadRedemptionMs}
              onChange={(e) => setVadRedemptionMs(Number(e.target.value))}
              style={{ width: '4rem', padding: '0.2rem', textAlign: 'center' }}
            />ms
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Pre-speech:
            <input type="number" min={0} step={100}
              value={vadPreSpeechPadMs}
              onChange={(e) => setVadPreSpeechPadMs(Number(e.target.value))}
              style={{ width: '4rem', padding: '0.2rem', textAlign: 'center' }}
            />ms
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Min speech:
            <input type="number" min={0} step={100}
              value={vadMinSpeechMs}
              onChange={(e) => setVadMinSpeechMs(Number(e.target.value))}
              style={{ width: '4rem', padding: '0.2rem', textAlign: 'center' }}
            />ms
          </label>
        </div>
      )}
    </div>
  );
}
