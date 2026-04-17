import { Panel } from './Panel';
import { RTLinePlot } from './RTLinePlot';
import { useStore } from '../../Store';

export function AnalyticsPanel() {
  const { rtHistory } = useStore();

  // Calculate latest RT value for status line
  const latestRT = rtHistory.length > 0
    ? rtHistory[rtHistory.length - 1].rtFactor
    : null;

  const statusText = latestRT !== null
    ? `Latest: ${latestRT.toFixed(2)}x`
    : 'No data';

  return (
    <Panel
      title="ASR Analytics"
      panelKey="analytics"
      statusContent={<span>{statusText}</span>}
    >
      <RTLinePlot data={rtHistory} />

      {rtHistory.length > 0 && (
        <div style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-muted)',
          marginTop: 'var(--space-xs)'
        }}>
          <span>Avg: {(rtHistory.reduce((sum, d) => sum + d.rtFactor, 0) / rtHistory.length).toFixed(2)}x</span>
          {' • '}
          <span>Min: {Math.min(...rtHistory.map(d => d.rtFactor)).toFixed(2)}x</span>
          {' • '}
          <span>Max: {Math.max(...rtHistory.map(d => d.rtFactor)).toFixed(2)}x</span>
        </div>
      )}
    </Panel>
  );
}
