import { useRef, useEffect } from 'react'
import './App.css'
import { useStore } from './Store';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isLoading, nodes, addNode } = useStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let frameCount = 0;

    // Aesthetics
    const drawNoise = () => {
      const { width, height } = canvas;
      // Black background
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);

      // Static
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const value = Math.floor(Math.random() * 256); // Random grayscale value
        data[i] = value;     // R
        data[i + 1] = value; // G
        data[i + 2] = value; // B
        data[i + 3] = 155;   // A
      }

      ctx.putImageData(imageData, 0, 0);
      requestAnimationFrame(drawNoise);
    };

    // Pulsing sphere
    const draw = () => {
      const { width, height } = canvas;

      if (!isLoading) {
        // Grey static circle when not loading
        ctx.shadowBlur = 0; // No glow
        ctx.fillStyle = 'grey';
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, 100, 0, Math.PI * 2);
        ctx.fill();
      } else {
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
      }

      requestAnimationFrame(draw);
    };

    drawNoise();
    draw();
  }, [isLoading]);

  // Actual work
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const handleMouseClick = (event: MouseEvent) => {
        switch (event.button) {
          case 0:
            addNode({
              X: (event.clientX),
              Y: (event.clientY),
            });
            break;
          default:
            break;
        }
      };
      canvas.addEventListener('mousedown', handleMouseClick);
      return () => {
        canvas.removeEventListener('mousedown', handleMouseClick);
      };
    }
  }, []);

  return (
    <div>
      <h1>I saw the Canvas glow</h1>
      <canvas ref={canvasRef} width="800" height="600"></canvas>

      <div style={{ display: 'flex' }}>
        {nodes.map((node, index) => (
          <div key={index} style={{ marginRight: '10px' }}>
            X: {node.X}, Y: {node.Y}
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
