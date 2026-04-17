import './RTLinePlot.css';

type RTLinePlotProps = {
  data: Array<{ timestamp: number; rtFactor: number }>;
  width?: number;
  height?: number;
};

// Calculate rolling standard deviation
function calculateRollingStdDev(data: Array<{ rtFactor: number }>, windowSize: number = 5): number[] {
  const result: number[] = [];

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = data.slice(start, i + 1);

    const mean = window.reduce((sum, d) => sum + d.rtFactor, 0) / window.length;
    const variance = window.reduce((sum, d) => sum + Math.pow(d.rtFactor - mean, 2), 0) / window.length;
    const stdDev = Math.sqrt(variance);

    result.push(stdDev);
  }

  return result;
}

export function RTLinePlot({ data, width = 400, height = 120 }: RTLinePlotProps) {
  if (data.length === 0) {
    return <div className="rt-plot-empty">No data yet</div>;
  }

  // Main plot: Fixed Y-axis range: 0 to 2.0x
  const yMin = 0;
  const yMax = 2.0;

  // X-axis: point index (last N points)
  const xMax = Math.max(data.length - 1, 1);

  // Scale helpers for main plot
  const xScale = (index: number) => (index / xMax) * width;
  const yScale = (rt: number) => height - ((rt - yMin) / (yMax - yMin)) * height;

  // Generate SVG path for RT line
  const pathData = data
    .map((d, i) => {
      const x = xScale(i);
      const y = yScale(Math.min(d.rtFactor, yMax)); // Clamp to max
      return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
    })
    .join(' ');

  // Variance plot
  const varianceHeight = 60;
  const stdDevs = calculateRollingStdDev(data);
  const maxStdDev = Math.max(...stdDevs, 0.5); // At least 0.5 for scale

  const yScaleVariance = (stdDev: number) =>
    varianceHeight - (stdDev / maxStdDev) * varianceHeight;

  const variancePathData = stdDevs
    .map((stdDev, i) => {
      const x = xScale(i);
      const y = yScaleVariance(stdDev);
      return i === 0 ? `M ${x},${y}` : `L ${x},${y}`;
    })
    .join(' ');

  return (
    <div className="rt-plot-container">
      {/* Main RT plot */}
      <svg className="rt-line-plot" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* 1x reference line (center) - grey solid */}
        <line x1={0} y1={yScale(1.0)} x2={width} y2={yScale(1.0)}
              stroke="var(--color-text-dim)" strokeWidth={.5} />

        {/* RT line path - blue, thin */}
        <path d={pathData} fill="none" stroke="#60a5fa" strokeWidth={.5} />

        {/* Y-axis labels */}
        <text x={5} y={yScale(2.0) + 12} fontSize="8" fill="var(--color-text-muted)">2.0x</text>
        <text x={5} y={yScale(1.0) + 12} fontSize="8" fill="var(--color-text-muted)">1.0x</text>
        <text x={5} y={yScale(0.0) - 5} fontSize="8" fill="var(--color-text-muted)">0.0x</text>
      </svg>

      {/* Variance plot (mini) */}
      <div className="rt-variance-label">Variance (σ)</div>
      <svg className="rt-variance-plot" width={width} height={varianceHeight} viewBox={`0 0 ${width} ${varianceHeight}`}>
        {/* Variance line - dashed, orange */}
        <path d={variancePathData} fill="none" stroke="#fb923c" strokeWidth={1} strokeDasharray="2,2" />

        {/* Y-axis label */}
        <text x={5} y={12} fontSize="8" fill="var(--color-text-muted)">{maxStdDev.toFixed(2)}</text>
        <text x={5} y={varianceHeight - 5} fontSize="10" fill="var(--color-text-muted)">0</text>
      </svg>
    </div>
  );
}
