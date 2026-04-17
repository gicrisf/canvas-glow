import { useRef, useEffect, useState } from 'react';
import { useStore } from '../../Store';
import './TranscriptPanel.css';

export function TranscriptPanel() {
  const { transcripts } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  // Check for overflow and scroll to bottom when transcripts change
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const isOverflowing = content.scrollHeight > container.clientHeight;
    setHasOverflow(isOverflowing);

    // Scroll to show latest transcript at the bottom
    if (isOverflowing) {
      container.scrollTop = container.scrollHeight;
    }
  }, [transcripts]);

  if (transcripts.length === 0) {
    return null;
  }

  return (
    <div className="transcript-panel">
      <h3>Transcript</h3>
      <div
        ref={containerRef}
        className={`transcript-container ${hasOverflow ? 'has-overflow' : ''}`}
      >
        <div ref={contentRef} className="transcript-content">
          {transcripts.map((text, index) => {
            const isLatest = index === transcripts.length - 1;
            return (
              <span
                key={index}
                className={isLatest ? 'transcript-line latest' : 'transcript-line'}
              >
                {text}{' '}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
