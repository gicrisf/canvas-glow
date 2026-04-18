import { useEffect, useState } from 'react';
import { useStore } from '../../Store';
import { Panel } from './Panel';
import './LatencyPanel.css';

export function LatencyPanel() {
  const { requestHistory, pendingRequests } = useStore();
  const [, setTick] = useState(0);

  // Force re-render every 100ms while there are pending requests
  useEffect(() => {
    if (pendingRequests.length === 0) return;
    const interval = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(interval);
  }, [pendingRequests.length]);

  // Status line: pending count + latest E2E
  const pendingCount = pendingRequests.length;
  const latestE2E = requestHistory.length > 0
    ? requestHistory[requestHistory.length - 1].e2eMs
    : null;

  const statusParts: string[] = [];
  if (pendingCount > 0) {
    statusParts.push(`${pendingCount} pending`);
  }
  if (latestE2E !== null) {
    statusParts.push(`Latest: ${latestE2E.toFixed(0)}ms`);
  }
  const statusText = statusParts.length > 0 ? statusParts.join(' · ') : 'No data';

  // Calculate stats
  const avgE2E = requestHistory.length > 0
    ? requestHistory.reduce((sum, r) => sum + r.e2eMs, 0) / requestHistory.length
    : 0;
  const avgOverhead = requestHistory.length > 0
    ? requestHistory.reduce((sum, r) => sum + r.overheadMs, 0) / requestHistory.length
    : 0;
  const avgOverheadPercent = requestHistory.length > 0
    ? requestHistory.reduce((sum, r) => sum + r.overheadPercent, 0) / requestHistory.length
    : 0;

  // Find max E2E for scaling the bars
  const maxE2E = requestHistory.length > 0
    ? Math.max(...requestHistory.map(r => r.e2eMs))
    : 100;

  return (
    <Panel
      title="E2E Latency"
      panelKey="latency"
      statusContent={<span>{statusText}</span>}
    >
      {requestHistory.length === 0 ? (
        <div className="latency-empty">No requests yet</div>
      ) : (
        <>
          {/* Stacked bar chart */}
          <div className="latency-chart">
            <div className="latency-bars">
              {requestHistory.map((req, i) => {
                const serverWidth = (req.serverTotalMs / maxE2E) * 100;
                const overheadWidth = (req.overheadMs / maxE2E) * 100;
                return (
                  <div
                    key={req.requestId}
                    className="latency-bar-row"
                    title={`E2E: ${req.e2eMs.toFixed(0)}ms (Server: ${req.serverTotalMs.toFixed(0)}ms + Overhead: ${req.overheadMs.toFixed(0)}ms)`}
                  >
                    <div className="latency-bar-index">{i + 1}</div>
                    <div className="latency-bar-container">
                      <div
                        className="latency-bar-server"
                        style={{ width: `${serverWidth}%` }}
                      />
                      <div
                        className="latency-bar-overhead"
                        style={{ width: `${overheadWidth}%` }}
                      />
                    </div>
                    <div className="latency-bar-value">{req.e2eMs.toFixed(0)}</div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="latency-legend">
              <span className="latency-legend-item">
                <span className="latency-legend-color latency-legend-server" />
                Server
              </span>
              <span className="latency-legend-item">
                <span className="latency-legend-color latency-legend-overhead" />
                Overhead
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="latency-stats">
            <span>Avg: {avgE2E.toFixed(0)}ms</span>
            {' · '}
            <span>Overhead: {avgOverhead.toFixed(0)}ms ({avgOverheadPercent.toFixed(0)}%)</span>
            {' · '}
            <span>Min: {Math.min(...requestHistory.map(r => r.e2eMs)).toFixed(0)}ms</span>
            {' · '}
            <span>Max: {maxE2E.toFixed(0)}ms</span>
          </div>
        </>
      )}

      {/* Pending requests */}
      {pendingCount > 0 && (
        <div className="latency-pending">
          <div className="latency-pending-header">Pending ({pendingCount})</div>
          <div className="latency-pending-list">
            {pendingRequests.map((req) => {
              const elapsed = Date.now() - req.startTime;
              return (
                <div key={req.requestId} className="latency-pending-item">
                  <span className="latency-pending-dot" />
                  <span>{elapsed.toFixed(0)}ms elapsed</span>
                  <span className="latency-pending-audio">({req.audioDurationMs.toFixed(0)}ms audio)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}
