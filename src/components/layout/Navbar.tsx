import { useStore } from '../../Store';
import './Navbar.css';

export function Navbar() {
  const { isRecording, isProcessing } = useStore();

  // Determine status text and color
  let statusText = 'Idle';
  let statusColor = '#6b7280'; // grey

  if (isProcessing) {
    statusText = 'Processing';
    statusColor = '#9370db'; // medium purple
  } else if (isRecording) {
    statusText = 'Listening';
    statusColor = '#ff69b4'; // hot pink
  }

  return (
    <nav className="navbar">
      <h1 className="navbar-title">I heard the canvas glow</h1>
      <div className="navbar-status">
        <span className="status-dot" style={{ backgroundColor: statusColor }}></span>
        <span className="status-text">{statusText}</span>
      </div>
    </nav>
  );
}
