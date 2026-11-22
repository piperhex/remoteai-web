import { useEffect, type ReactNode } from 'react';
import { Alert } from 'antd';
import { uiText } from '../localization/uiText';
import { useLanguage } from '../localization/browserClient';
import type { DictationClient } from '../chat/dictation/client';
import { useCliGui } from './context';
import { CliMessages, type CliMessagesProps } from './CliMessages';
import { CliPermissions } from './CliPermissions';
import { CliComposer, type CliComposerProps } from './CliComposer';
import { CliInstaller } from './CliInstaller';
import { cliErrorText } from './errors';
import { useGuiFontSize, guiFontStyle } from '../appearance/fontSize';
import styles from '../conversation/styles.module.less';
import type { ChatConnectionProps } from '../remote-chat/views/ChatProfileMenu';
import type { CliImageInput } from './useCliImages';
import { CliImageProvider } from './CliImageProvider';
import { ToolDetailsContext } from '../chat/DeferredToolDetails';

function InstallationConversation({ footer }: { footer: ReactNode }) {
  return <div className={styles.messageArea}>
    <div className={styles.messageViewport}>
      <div className={styles.messageScrollBody}>
        <div className="cli-gui-install-region"><CliInstaller /></div>
        <div className={styles.messageFooter}>{footer}</div>
      </div>
    </div>
  </div>;
}

export function CliConversationPane({ cwd = '', projectPicker, dictation, active = true,
  renderMessages = props => <CliMessages {...props} />, scrollableComposer, remoteLayout = false,
  composerHeader, connectionInfo, connection, connected, readClipboardImages, nativeFileDrop,
  renderComposer = props => <CliComposer {...props} /> }: CliImageInput & {
  cwd?: string; projectPicker?: ReactNode; dictation?: DictationClient;
  active?: boolean; scrollableComposer?: boolean; remoteLayout?: boolean;
  composerHeader?: ReactNode; connectionInfo?: ReactNode;
  connection?: ChatConnectionProps; connected?: boolean;
  renderComposer?: (props: CliComposerProps) => ReactNode;
  renderMessages?: (props: CliMessagesProps) => ReactNode;
}) {
  useLanguage();
  const cli = useCliGui();
  const fontSize = useGuiFontSize();
  useEffect(() => { if (cli && !cli.state.cwd && cwd) cli.controller.patch({ cwd }); }, [cwd, cli?.controller]);
  if (!cli || cli.state.engine === 'codex') return null;
  const { state, controller } = cli;
  const status = state.runtime[state.engine === 'claude' ? 'claude' : 'gemini'];
  const ready = status?.status === 'ready';
  const footer = <>
    {state.selected && <CliPermissions session={state.selected} busy={state.busy || !ready}
      respond={controller.act} remoteLayout={remoteLayout} />}
    {renderComposer({ projectPicker, dictation, remoteLayout, active, composerHeader, connectionInfo,
      connection, connected, readClipboardImages, nativeFileDrop })}
  </>;
  return <ToolDetailsContext.Provider value={{ load: controller.loadToolDetails, active: active && ready }}>
    <CliImageProvider ready={connected ?? true}><section className="cli-gui-pane" style={guiFontStyle(fontSize)}
    aria-label={uiText('client.cliGui.conversation')}>
    {state.error && <Alert type="error" showIcon message={cliErrorText(state.error)} closable
      onClose={() => controller.patch({ error: '' })} />}
    {!ready ? <InstallationConversation footer={footer} /> : renderMessages({ history: state.olderView ?? state.history,
      showLatest: state.olderView && controller.showLatest,
      selected: state.selected?.id ?? null, loading: state.loading, loadOlder: controller.loadOlder,
      footer, active, scrollableComposer })}
  </section></CliImageProvider></ToolDetailsContext.Provider>;
}
