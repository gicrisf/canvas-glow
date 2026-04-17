import { useStore } from '../../Store';
import './Navbar.css';

export function Navbar() {
  const { isRecording, isProcessing } = useStore();

  // Determine status text and color
  let statusText = 'IDLE';
  let statusColor = 'var(--color-idle)';

  if (isProcessing) {
    statusText = 'PROCESSING';
    statusColor = 'var(--color-processing)';
  } else if (isRecording) {
    statusText = 'LISTENING';
    statusColor = 'var(--color-recording)';
  }

  return (
    <nav className="navbar">
      <h1 className="navbar-title">I heard the canvas glow</h1>
      <div className="navbar-status">
        <span className="status-text" style={{ color: statusColor }}>
          ● {statusText}
        </span>
      </div>
    </nav>
  );
}
