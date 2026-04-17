import { Panel } from './Panel';
import { VADSettings } from './VADSettings';
import { useStore } from '../../Store';

export function VADPanel() {
  const { vadEnabled, realtimeMode, vadStatus, vadSystem, vadLoading } = useStore();

  const statusText = !realtimeMode
    ? 'Realtime mode required'
    : !vadEnabled
      ? 'VAD OFF'
      : vadLoading
        ? 'Loading Silero VAD model...'
        : vadSystem !== 'silero'
          ? `VAD system "${vadSystem}" not yet implemented`
          : (vadStatus || 'VAD Active');

  return (
    <Panel
      title="Voice Activity Detection"
      panelKey="vad"
      statusContent={<span>{statusText}</span>}
    >
      <VADSettings />
    </Panel>
  );
}
