import { useStore } from '../../Store';
import './Panel.css';

type PanelProps = {
  title: string;
  panelKey: string;
  statusContent?: React.ReactNode;
  children: React.ReactNode;
};

export function Panel({ title, panelKey, statusContent, children }: PanelProps) {
  const { sectionState, setSectionOpen } = useStore();
  const isOpen = sectionState[panelKey] ?? true;

  return (
    <div className="panel">
      <button className="panel-header" onClick={() => setSectionOpen(panelKey, !isOpen)}>
        <div className="panel-title-row">
          <span className="panel-title">{title}</span>
          <span className="panel-toggle">{isOpen ? '▼' : '▶'}</span>
        </div>
        {statusContent && (
          <div className="panel-status-line">
            {statusContent}
          </div>
        )}
      </button>
      {isOpen && (
        <div className="panel-content">
          {children}
        </div>
      )}
    </div>
  );
}
