import { useRef, useEffect } from 'react'
import { useStore } from './Store';
import './App.css'

function NumberToString({ number }: { number: number }) {
  const stringNumber = number.toString(); // or `${number}`
  return <div>{stringNumber}</div>;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // const isLoadingMove = useStore((state) => state.isLoadingMove);
  const sendMousePosition = useStore((state) => state.sendMousePosition);
  const discardedMoves = useStore((state) => state.discardedMoves);
  const actions = useStore((state) => state.actions);
  const updateLastAction = useStore((state) => state.updateLastAction);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error("Canvas ctx not found!");
      }

      // Store the last N points of the cursor path
      const MAX_POINTS = 60;
      let points: { x: number, y: number }[] = [];

      // Initialize with center point
      points.push({ x: canvas.width / 2, y: canvas.height / 2 });

      // Draw a smooth path following the cursor
      const draw = () => {
        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);

        if (points.length > 1) {
          ctx.save();
          ctx.shadowBlur = 20;
          ctx.shadowColor = 'rgba(255, 105, 180, 0.8)';

          // Gradient from start to end of path
          const start = points[0];
          const end = points[points.length - 1];
          const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
          gradient.addColorStop(0, 'white');
          gradient.addColorStop(1, 'rgba(255, 105, 180, 0.3)');

          ctx.strokeStyle = gradient;
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();
          ctx.restore();
        }

        requestAnimationFrame(draw);
      };

      // Mouse move handler for canvas
      const handleMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        points.push({ x, y });
        if (points.length > MAX_POINTS) {
          points.shift();
        }
      };
      canvas.addEventListener('mousemove', handleMove);
      draw();
      return () => {
        canvas.removeEventListener('mousemove', handleMove);
      };
    }
  }, []);

  // Actual work
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const handleMouseClick = (event: MouseEvent) => {
        switch (event.button) {
          case 0:
            updateLastAction('click');
            // addNode({
              // X: (event.clientX),
              // Y: (event.clientY),
            // });
            break;
          default:
            break;
        }
      };

      const handleMouseMove = (event: MouseEvent) => {
        sendMousePosition({
          X: (event.clientX),
          Y: (event.clientY),
        })
      };

      canvas.addEventListener('mousedown', handleMouseClick);
      canvas.addEventListener('mousemove', handleMouseMove);
      return () => {
        canvas.removeEventListener('mousedown', handleMouseClick);
        canvas.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, []);

  return (
    <div>
      <h1>I saw the lazo glow</h1>
      <h3>&gt; Discarded moves: <NumberToString number={discardedMoves} /></h3>
      <h3 data-testid="last-action">
        &gt; Last action: {(() => {
          if (actions.length === 0) return '(none)';
          const last = actions[actions.length - 1];
          return `(${last.name} ${last.index})`;
        })()}
      </h3>
      <canvas ref={canvasRef} width="800" height="600"></canvas>
      <div style={{ marginTop: 20 }}>
        <h3>All points received:</h3>
        <div data-testid="all-points" style={{ maxHeight: 200, overflowY: 'auto', fontFamily: 'monospace' }}>
          {(() => {
            const actions = useStore((state) => state.actions);
            return `(${actions.map((action) => {
              const pointsSexpr = action.points && action.points.length > 0
                ? `(${action.points.map(p => `(${p.X} ${p.Y})`).join(' ')})`
                : '()';
              return `(${action.name} ${action.index} ${pointsSexpr})`;
            }).join(' ')})`;
          })()}
        </div>
      </div>
    </div>
  )
}

export default App
