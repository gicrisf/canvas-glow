import { useState } from 'react';
import { ServerSettings } from './ServerSettings';
import { ASRSettings } from './ASRSettings';
import { VADSettings } from './VADSettings';
import { AudioSettings } from './AudioSettings';
import './SettingsPanel.css';

type SectionProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

function Section({ title, isOpen, onToggle, children }: SectionProps) {
  return (
    <div className="settings-section">
      <button className="settings-section-header" onClick={onToggle}>
        <span>{title}</span>
        <span className="settings-section-toggle">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div className="settings-section-content">
          {children}
        </div>
      )}
    </div>
  );
}

export function SettingsPanel() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    server: true,
    asr: false,
    audio: false,
    vad: false,
  });

  const toggle = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="settings-panel">
      <h2 className="settings-title">Settings</h2>
      <div className="settings-sections">
        <Section title="Server" isOpen={openSections.server} onToggle={() => toggle('server')}>
          <ServerSettings />
        </Section>
        <Section title="ASR" isOpen={openSections.asr} onToggle={() => toggle('asr')}>
          <ASRSettings />
        </Section>
        <Section title="Audio Capture" isOpen={openSections.audio} onToggle={() => toggle('audio')}>
          <AudioSettings />
        </Section>
        <Section title="Voice Activity Detection" isOpen={openSections.vad} onToggle={() => toggle('vad')}>
          <VADSettings />
        </Section>
      </div>
    </div>
  );
}
