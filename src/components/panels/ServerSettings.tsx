import { useStore } from '../../Store';
import './FormControls.css';

export function ServerSettings() {
  const {
    serverUrl,
    setServerUrl,
    checkServerHealth,
  } = useStore();

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
        <button onClick={checkServerHealth} className="form-button">
          Check
        </button>
      </div>
    </div>
  );
}
