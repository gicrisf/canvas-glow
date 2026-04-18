import { Panel } from './Panel';
import { AudioSettings } from './AudioSettings';
import { useStore } from '../../Store';

export function AudioPanel() {
  const { captureMethod, realtimeMode } = useStore();

  const captureLabel = captureMethod === 'worklet' ? 'AudioWorklet' : 'MediaRecorder';
  const modeLabel = realtimeMode ? 'ON' : 'OFF';

  return (
    <Panel
      title="Audio Capture"
      panelKey="audio"
      statusContent={
        <>
          <span>{captureLabel}</span>
          <span>•</span>
          <span>Realtime {modeLabel}</span>
        </>
      }
    >
      <AudioSettings />
    </Panel>
  );
}
