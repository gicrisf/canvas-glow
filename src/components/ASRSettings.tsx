import { useStore } from '../Store';
import { LANGUAGES } from '../audio';

export function ASRSettings() {
  const { language, setLanguage } = useStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
    </div>
  );
}
