import { useStore } from '../../Store';

export function ServerSettings() {
  const {
    serverUrl,
    serverStatus,
    setServerUrl,
    checkServerHealth,
  } = useStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="http://localhost:8080"
          style={{ flex: 1, padding: '0.25rem' }}
        />
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
    </div>
  );
}
