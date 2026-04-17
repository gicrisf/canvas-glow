import { Panel } from './Panel';
import { AudioSettings } from './AudioSettings';
import { useStore } from '../../Store';

export function AudioPanel() {
  const { captureMethod, realtimeMode } = useStore();

  const captureLabel = captureMethod === 'worklet' ? 'AudioWorklet' : 'MediaRecorder';
  const modeLabel = realtimeMode ? 'Realtime ON' : 'Single Recording';

  return (
    <Panel
      title="Audio Capture"
      panelKey="audio"
      statusContent={
        <>
          <span>{captureLabel}</span>
          <span>•</span>
          <span>{modeLabel}</span>
        </>
      }
    >
      <AudioSettings />
    </Panel>
  );
}
