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

      let frameCount = 0;

      // Pulsing sphere
      const draw = () => {
        const { width, height } = canvas;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Pulsing sphere when loading
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(255, 105, 180, 0.8)';

        const gradient = ctx.createRadialGradient(
          width / 2 + Math.sin(frameCount * 0.05) * 50,
          height / 2 + Math.cos(frameCount * 0.05) * 50,
          0,
          width / 2 + Math.sin(frameCount * 0.05) * 50,
          height / 2 + Math.cos(frameCount * 0.05) * 50,
          100
        );
        gradient.addColorStop(0, 'white');
        gradient.addColorStop(1, 'rgba(255, 105, 180, 0.3)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        const radius = 100 + 20 * Math.sin(frameCount * 0.05);
        ctx.arc(
          width / 2 + Math.sin(frameCount * 0.05) * 50,
          height / 2 + Math.cos(frameCount * 0.05) * 50,
          radius, 0, Math.PI * 2
        );
        ctx.fill();

        frameCount++;

        requestAnimationFrame(draw);
      };

      draw();
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
      <h1>I saw the canvas glow</h1>
      <h2>MouseMove edition</h2> 
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
