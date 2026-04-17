import { useStore } from '../../Store';
import { Panel } from './Panel';
import './TranscriptPanel.css';

export function TranscriptPanel() {
  const { transcripts } = useStore();

  if (transcripts.length === 0) {
    return (
      <Panel
        title="Transcript"
        panelKey="transcript"
        statusContent={<span>0 total</span>}
      >
        <div className="transcript-content">
          <span className="transcript-empty">No transcript yet</span>
        </div>
      </Panel>
    );
  }

  // All transcripts except the latest
  const previousTranscripts = transcripts.slice(0, -1);
  const latestTranscript = transcripts[transcripts.length - 1];

  return (
    <Panel
      title="Transcript"
      panelKey="transcript"
      statusContent={<span>{transcripts.length} total</span>}
    >
      <div className="transcript-content">
        {previousTranscripts.map((text, index) => (
          <span key={index} className="transcript-previous">
            {text}{' '}
          </span>
        ))}
        <span className="transcript-latest">{latestTranscript}</span>
      </div>
    </Panel>
  );
}
