import { ReactNode } from 'react';
import { useStore } from '../../Store';

type HeroProps = {
  children: ReactNode;
};

export function Hero({ children }: HeroProps) {
  const { heroExpanded, toggleHero, isRecording, isProcessing, toggleRecording } = useStore();

  const buttonClass = isProcessing
    ? 'record-button processing'
    : isRecording
      ? 'record-button recording'
      : 'record-button idle';

  const buttonText = isProcessing
    ? 'Processing...'
    : isRecording
      ? 'Stop'
      : 'Start';

  return (
    <section className="hero">
      <div className="hero-header" onClick={toggleHero}>
        <span>Visualizer</span>
        <span className="hero-toggle">{heroExpanded ? '▼' : '▶'}</span>
      </div>

      {heroExpanded ? (
        <div className="hero-content">
          {children}
        </div>
      ) : (
        <div className="hero-collapsed">
          <button
            className={buttonClass}
            onClick={(e) => {
              e.stopPropagation();
              toggleRecording();
            }}
            disabled={isProcessing}
          >
            <span className="record-dot"></span>
            {buttonText}
          </button>
        </div>
      )}
    </section>
  );
}
