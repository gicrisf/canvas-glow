import { useEffect } from 'react';
import { useStore } from '../../Store';
import { LANGUAGES } from '../../audio';

export function ASRSettings() {
  const {
    language,
    systemPrompt,
    normalizeProbes,
    serverUrl,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>System Prompt:</span>
          <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
            Syncs to server on blur
          </span>
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          onBlur={handlePromptBlur}
          placeholder="e.g., Preserve spelling: JFK, NASA, OpenAI"
          rows={2}
          style={{
            width: '100%',
            padding: '0.5rem',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: '3rem',
          }}
        />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={normalizeProbes}
          onChange={(e) => setNormalizeProbes(e.target.checked)}
        />
        <span>Normalize probe names</span>
        <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>
          "L four fifteen" → "L-415"
        </span>
      </label>
    </div>
  );
}
