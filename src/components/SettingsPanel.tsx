import { useState } from 'react';
import { ServerSettings } from './ServerSettings';
import { ASRSettings } from './ASRSettings';
import { VADSettings } from './VADSettings';
import { AudioSettings } from './AudioSettings';

type SectionProps = {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

function Section({ title, isOpen, onToggle, children }: SectionProps) {
  return (
    <div style={{ borderBottom: '1px solid #333' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '0.5rem',
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          cursor: 'pointer',
          fontSize: '0.875rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>{title}</span>
        <span style={{ opacity: 0.5 }}>{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && (
        <div style={{ padding: '0.5rem', paddingTop: 0 }}>
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
    <div style={{
      width: '100%',
      border: '1px solid #333',
      borderRadius: '4px',
      marginTop: '0.5rem',
    }}>
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
  );
}
