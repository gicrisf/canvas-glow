import { useEffect } from 'react';
import { useStore } from '../../Store';
import { LANGUAGES } from '../../audio';
import './FormControls.css';

export function ASRSettings() {
  const {
    language,
    systemPrompt,
    normalizeProbes,
    serverUrl,
    setServerUrl,
    checkServerHealth,
    setLanguage,
    setSystemPrompt,
    fetchSystemPrompt,
    syncSystemPrompt,
    setNormalizeProbes,
    fetchNormalizeProbes,
  } = useStore();

  // Fetch settings from server on mount and when serverUrl changes
  useEffect(() => {
    fetchSystemPrompt();
    fetchNormalizeProbes();
  }, [serverUrl, fetchSystemPrompt, fetchNormalizeProbes]);

  const handlePromptChange = (value: string) => {
    setSystemPrompt(value);
  };

  const handlePromptBlur = () => {
    // Sync to server when user finishes editing
    syncSystemPrompt();
  };

  return (
    <div className="form-stack">
      {/* Server Address */}
      <div className="form-input-row">
        <label className="form-input-label">Server address</label>
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

      {/* Language */}
      <div className="form-input-row">
        <label className="form-input-label">Language</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="form-select form-input-flex"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang || 'Auto-detect'}
            </option>
          ))}
        </select>
      </div>

      {/* System Prompt */}
      <div className="form-group">
        <div className="form-row" style={{ justifyContent: 'space-between' }}>
          <label className="form-group-label">System Prompt</label>
          <span className="form-hint">Syncs to server on blur</span>
        </div>
        <textarea
          value={systemPrompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          onBlur={handlePromptBlur}
          placeholder="e.g., Preserve spelling: JFK, NASA, OpenAI"
          rows={2}
          className="form-textarea"
        />
      </div>

      {/* Normalize Probes */}
      <label className="form-label">
        <input
          type="checkbox"
          checked={normalizeProbes}
          onChange={(e) => setNormalizeProbes(e.target.checked)}
        />
        <span>Normalize probe names</span>
        <span className="form-hint">"L four fifteen" → "L-415"</span>
      </label>
    </div>
  );
}
