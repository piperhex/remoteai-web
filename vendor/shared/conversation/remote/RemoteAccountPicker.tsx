import { message } from 'antd';
import { useCliGui } from '../../cli-gui/context';
import { guiAccountSelectionForEngine, isGuiAccountSelected } from '../../remote-chat/guiAccounts';
import { uiText } from "../../localization/uiText";
import { remoteErrorText } from "../../localization/errors";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshCw, Settings } from 'lucide-react';
import type { GuiAccountsClient, SelectableGuiAccount } from '../../remote-chat/guiAccounts';
import { useGuiAccounts } from '../../remote-chat/client/useGuiAccounts';
import { maskAccountEmail } from '../../accounts/privacy';
import { GuiAccountMenu } from '../GuiAccountMenu';
import { GuiAccountList } from '../GuiAccountList';
import { RemoteAccountSummary } from './RemoteAccountSummary';
import type { GuiComputerNavigation } from './types';
import styles from '../ProxyAccountPicker.module.less';

export const ACCOUNT_REFRESH_MS = 60_000;
export const RemoteGuiAccountsContext = createContext<ReturnType<typeof useGuiAccounts> | null>(null);

interface Props {
  active: boolean; ready: boolean; client: GuiAccountsClient; computers: GuiComputerNavigation; privacyMode: boolean;
  renderSettings?: (onClose: () => void) => ReactNode;
}

export function RemoteAccountPicker(props: Props) {
  const accounts = useContext(RemoteGuiAccountsContext);
  return accounts ? <AccountPicker {...props} accounts={accounts} /> : <StandaloneAccountPicker {...props} />;
}

function StandaloneAccountPicker(props: Props) {
  const accounts = useGuiAccounts(props.client, props.ready && props.active, ACCOUNT_REFRESH_MS);
  return <AccountPicker {...props} accounts={accounts} />;
}

function AccountPicker({ active, ready, computers, privacyMode, renderSettings, accounts }:
  Props & { accounts: ReturnType<typeof useGuiAccounts> }) {
  const [open, setOpen] = useState(false);
  const cli = useCliGui();
  const [notice, noticeContext] = message.useMessage();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const selection = guiAccountSelectionForEngine(accounts.snapshot?.selection,
    accounts.snapshot?.choices ?? [], cli?.state.engine);
  const current = accounts.snapshot?.choices.find(choice => isGuiAccountSelected(choice, selection));
  const name = current ? privacyMode && current.kind === 'account' ? maskAccountEmail(current.name) : current.name
    : uiText("client.conversation.chooseGuiAccount");
  const disabled = !ready || accounts.loading || Boolean(accounts.saving) || !accounts.snapshot?.running;
  useEffect(() => { if (!active) { setOpen(false); setSettingsOpen(false); } }, [active]);
  const select = async (kind: SelectableGuiAccount['kind'], id: string) => {
    const claude = accounts.snapshot?.choices.some(choice => choice.id === id && choice.kind === kind
      && choice.accountSource === 'claudeCode');
    if (await accounts.select({ kind, id, ...(cli ? { engine: cli.state.engine } : {}) })) {
      setOpen(false); trigger.current?.focus();
      if (claude) void notice.success({ content: uiText('client.officialAccounts.switched'),
        style: { maxWidth: 400, margin: '0 auto' } });
    }
  };
  const choices = accounts.snapshot?.choices.map((choice) => ({ ...choice,
    // Older computers only send a full description; render it once without adding empty quota fields.
    accountDetails: choice.kind === 'account' && choice.accountSource !== 'claudeCode' && choice.plan !== undefined
      && choice.primaryRemainingPercent !== undefined && choice.secondaryRemainingPercent !== undefined
      ? { plan: choice.plan, primaryRemainingPercent: choice.primaryRemainingPercent,
        secondaryRemainingPercent: choice.secondaryRemainingPercent } : undefined,
    selected: isGuiAccountSelected(choice, selection), disabled: !choice.available })) ?? [];
  const panel = (devicePicker: ReactNode) => <GuiAccountList choices={choices} devicePicker={devicePicker}
    disabled={disabled} loading={accounts.loading || Boolean(accounts.saving)}
    onSelectAccount={(id) => { void select('account', id); }}
    onSelectAggregate={(id) => { void select('aggregate', id); }}
    onSelectProvider={(id) => { void select('provider', id); }} footer={<>
      {!ready && <p className={styles.hint}>{uiText("client.chat.connectToYourComputerToSwitchAccounts")}</p>}
      {ready && accounts.snapshot && !accounts.snapshot.running
        && <p className={styles.hint}>{uiText("client.workspaceActions.startTheLocalProxyOnThisComputerFirst")}</p>}
      {accounts.error && <p className={styles.error} role="alert">{remoteErrorText(accounts.error)}</p>}
      {renderSettings ? <button type="button" className={styles.settings}
        aria-label={uiText('client.workspaceSettings.codexGuiSettings')} aria-haspopup="dialog"
        disabled={!ready || accounts.loading || Boolean(accounts.saving)}
        onClick={() => { setOpen(false); setSettingsOpen(true); }}>
        <Settings size={19} />{uiText('client.app.settings')}</button> :
      <button type="button" className={styles.settings} aria-label={uiText("client.workspaceActions.refreshAccountList")}
        disabled={!ready || accounts.loading || Boolean(accounts.saving)} onClick={accounts.refresh}>
        <RefreshCw size={17} />{uiText("client.workspaceActions.refreshAccounts")}</button>}
    </>} />;
  return <><GuiAccountMenu active={active} open={open} trigger={trigger} name={name} computers={computers}
    busy={Boolean(accounts.saving)} accounts={panel}
    onOpenChange={(next) => { setOpen(next); if (next && ready) accounts.refresh(); }}
    summary={<RemoteAccountSummary name={name} current={current} ready={ready}
      running={accounts.snapshot?.running} />} />
    {noticeContext}
    {settingsOpen && active && renderSettings?.(() => { setSettingsOpen(false); trigger.current?.focus(); })}
  </>;
}
