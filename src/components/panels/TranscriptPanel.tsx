import { useStore } from '../../Store';
import './TranscriptPanel.css';

export function TranscriptPanel() {
  const { transcripts } = useStore();

  if (transcripts.length === 0) {
    return null;
  }

  // Show latest transcript only, truncated with ellipsis
  const latestTranscript = transcripts[transcripts.length - 1];

  return (
    <span className="transcript-inline">
      {latestTranscript}
    </span>
  );
}
