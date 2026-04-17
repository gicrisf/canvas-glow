import { Panel } from './Panel';
import { ServerSettings } from './ServerSettings';
import { useStore } from '../../Store';
import './FormControls.css';

export function ServerPanel() {
  const { serverStatus } = useStore();

  const statusClass =
    serverStatus === 'ok' ? 'form-status-ok' :
    serverStatus === 'error' ? 'form-status-error' :
    serverStatus === 'loading' ? 'form-status-warning' : 'form-status-unknown';

  return (
    <Panel
      title="Server"
      panelKey="server"
      statusContent={
        <span className={statusClass}>● {serverStatus.toUpperCase()}</span>
      }
    >
      <ServerSettings />
    </Panel>
  );
}
