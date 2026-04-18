import { Panel } from './Panel';
import { ASRSettings } from './ASRSettings';
import { useStore } from '../../Store';
import './FormControls.css';

export function ASRPanel() {
  const { serverStatus, rtHistory } = useStore();

  const statusClass =
    serverStatus === 'ok' ? 'form-status-ok' :
    serverStatus === 'error' ? 'form-status-error' :
    serverStatus === 'loading' ? 'form-status-warning' : 'form-status-unknown';

  // Get latest ASR metrics from rtHistory
  const latestMetrics = rtHistory.length > 0 ? rtHistory[rtHistory.length - 1] : null;
  const metricsText = latestMetrics
    ? `Latest: ${Math.round(latestMetrics.totalMs)}ms, ${latestMetrics.tokS.toFixed(1)} tok/s, rt ${latestMetrics.rtFactor.toFixed(1)}`
    : null;

  return (
    <Panel
      title="ASR"
      panelKey="asr"
      statusContent={
        <>
          <span className={statusClass}>● {serverStatus.toUpperCase()}</span>
          {metricsText && (
            <>
              <span>•</span>
              <span>{metricsText}</span>
            </>
          )}
        </>
      }
    >
      <ASRSettings />
    </Panel>
  );
}
