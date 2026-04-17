import { Panel } from './Panel';
import { ASRSettings } from './ASRSettings';
import { useStore } from '../../Store';

export function ASRPanel() {
  const { asrStatus } = useStore();

  return (
    <Panel
      title="ASR"
      panelKey="asr"
      statusContent={asrStatus ? <span>{asrStatus}</span> : <span>Ready</span>}
    >
      <ASRSettings />
    </Panel>
  );
}
