import { useStore } from '../../Store';
import './FormControls.css';

export function ServerSettings() {
  const {
    serverUrl,
    serverStatus,
    setServerUrl,
    checkServerHealth,
  } = useStore();

  const statusClass =
    serverStatus === 'ok' ? 'form-status-ok' :
    serverStatus === 'error' ? 'form-status-error' :
    serverStatus === 'loading' ? 'form-status-warning' : 'form-status-unknown';

  return (
    <div className="form-stack">
      <div className="form-row">
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="http://localhost:8080"
          className="form-input form-input-flex"
        />
        <span className={statusClass}>{serverStatus}</span>
        <button onClick={checkServerHealth} className="form-button">
          Check
        </button>
      </div>
    </div>
  );
}
