import { useEffect, useState, type ReactElement } from 'react';
import { Alert, Button, Tooltip } from 'antd';
import { ArrowUpRight, FolderTree, Home, KeyRound, Plus, RefreshCw, Server, Settings2, Terminal } from 'lucide-react';
import { displayText as t } from '../../localization/messages';
import { remoteErrorText } from '../../localization/errors';
import { useGuiLanguage } from '../../localization/useGuiLanguage';
import { enqueueSshDownload } from '../../downloads/sshDownload';
import { ResizableSidebar } from '../../layout/ResizableSidebar';
import type { SidebarSizing } from '../../layout/useSidebarResize';
import { SshConnectionDialog } from '../SshConnectionDialog';
import { SshLaunchDialog } from './SshLaunchDialog';
import type { ChatComputer } from '../../remote-chat/devices';
import { SshComputerMenu } from './SshComputerMenu';
import type { SshHost, SshHostDirectory } from './useSshHosts';
import { SshProjectBrowser } from '../SshProjectBrowser';
import { SshProfileList } from '../SshProfileList';
import { sshLabel, type SshProfile } from '../sshProfiles';
import { useSshProfiles } from '../useSshProfiles';
import { useSshDropQueue } from '../useSshDropQueue';
import { TerminalTabStrip } from '../views/TerminalTabStrip';
import { TerminalPane, nativeDrop } from '../views/TerminalPanel';
import { MAX_TERMINAL_TABS } from '../views/useTerminalPanel';
import type { TerminalInfo } from '../types';
import { useRecentSshProfiles, useSshSessions } from './useSshSessions';
import { ServerMonitor } from './ServerMonitor';
import { SshRemoveProfileDialog } from './SshRemoveProfileDialog';
import { SshSessionMenu } from './SshSessionMenu';
import './workspace.css';

interface Props {
  defaultHost: SshHost; directory: SshHostDirectory; active: boolean; scope: string; login?: () => void;
}

// The remote terminal list uses this opaque project association to isolate SSH tabs from chat terminals.
const SSH_WORKSPACE = 'remoteai:ssh-workspace';
const SSH_SIDEBAR: SidebarSizing = {
  storageKey: 'codex-switch:ssh-workspace-sidebar-width',
  minimum: 180,
  minimumContent: 300,
  defaultWidth: available => available <= 630 ? available * 0.36 : Math.max(235, Math.min(330, available * 0.25)),
};
type WorkspaceDialog = { kind: 'new' | 'manage'; profile?: undefined } | { kind: 'edit' | 'remove'; profile: SshProfile };

export function SshWorkspace({ defaultHost, directory, active, scope, login }: Props) {
  useGuiLanguage();
  const { api, ready: available } = defaultHost;
  const ssh = api.ssh!;
  const saved = useSshProfiles(ssh.profiles, active);
  const sessions = useSshSessions();
  const recent = useRecentSshProfiles(scope);
  const uploads = useSshDropQueue(sessions.tabs.map(tab => tab.id));
  const [editor, setEditor] = useState<WorkspaceDialog>();
  const [connecting, setConnecting] = useState<{ profile: SshProfile; device: ChatComputer }>();
  const [files, setFiles] = useState(true);
  useEffect(() => { if (!active) { setEditor(undefined); setConnecting(undefined); } }, [active]);
  const current = sessions.tabs.find(tab => tab.id === sessions.selected);
  const limit = sessions.tabs.length >= MAX_TERMINAL_TABS;
  const canConnect = !login && !limit && !saved.error;
  const closeDialog = () => { setEditor(undefined); setConnecting(undefined); };
  const adopt = (info: TerminalInfo, host = defaultHost) => {
    sessions.adopt(info, host);
    const profile = connecting?.profile ?? saved.profiles.find(p => info.ssh && sshLabel(p) === sshLabel(info.ssh));
    if (profile) recent.remember(profile.id);
    setFiles(true);
  };
  const create = () => {
    if (login) { login(); return; }
    setEditor({ kind: 'new' });
  };
  const connect = (profile: SshProfile, device: ChatComputer) => {
    if (!canConnect || !device.online) return;
    directory.request(device.deviceId);
    setConnecting({ profile, device });
  };
  const computerMenu = (profile: SshProfile, trigger: ReactElement) =>
    <SshComputerMenu key={profile.id} disabled={!canConnect || saved.loading} directory={directory}
      choose={device => connect(profile, device)}>{trigger}</SshComputerMenu>;
  const recentProfiles = recent.ids.flatMap(id => saved.profiles.find(p => p.id === id) ?? []);
  const showFiles = Boolean(current && files);
  return <section className="ssh-workspace" aria-label={t('client.discovery.ssh')} hidden={!active}>
    <header className="sshw-header"><span className="sshw-mark"><Terminal size={20} /></span>
      <h1>{t('client.discovery.ssh')}</h1>
      <div className="sshw-tools">
        <Tooltip title={t('client.ssh.refresh')}><Button aria-label={t('client.ssh.refresh')}
          icon={<RefreshCw size={15} />} loading={saved.loading} onClick={() => void saved.refresh()} /></Tooltip>
        <Button icon={<Settings2 size={15} />} onClick={() => login ? login() : setEditor({ kind: 'manage' })}>
          {t('client.ssh.manage')}</Button>
      </div>
    </header>
    {(saved.error || sessions.error || !directory.devices.some(device => device.online) || !!login || limit) && <Alert type="warning" showIcon
      message={remoteErrorText(saved.error || sessions.error || (limit ? 'client.ssh.limit' : 'client.discovery.sshComputerHint'))}
      action={login && <Button onClick={login}>{t('client.lounge.login')}</Button>} />}
    <div className="sshw-body">
      <ResizableSidebar className="sshw-rail" layoutSelector=".sshw-body" sizing={SSH_SIDEBAR}
        resizeLabel={t(showFiles ? 'client.ssh.files' : 'client.ssh.savedConnections')}>
        {current && <div className="sshw-switch">
          <button type="button" aria-label={t('client.ssh.savedConnections')} aria-pressed={!files}
            onClick={() => setFiles(false)}><Server size={15} />{t('client.ssh.savedConnection')}</button>
          <button type="button" aria-label={t('client.ssh.files')} aria-pressed={files}
            onClick={() => setFiles(true)}><FolderTree size={15} />{t('client.chat.files.39932f')}</button>
        </div>}
        <div className="sshw-profiles" hidden={showFiles}>
          <SshProfileList profiles={saved.profiles} disabled={saved.loading || !canConnect} loading={saved.loading} inlineCreate
            onAction={active && !showFiles && !login && !saved.error ? (kind, profile) => setEditor({ kind, profile }) : undefined}
            choose={create} selected={connecting?.profile} renderPicker={active && !showFiles ? computerMenu : undefined} />
        </div>
        {sessions.tabs.map(tab => <div className="sshw-files" key={tab.id} hidden={!showFiles || tab.id !== current?.id}>
          <SshProjectBrowser id={tab.id} api={tab.host.api.ssh!} active={active && showFiles && tab.id === current?.id}
            nativeDrop={nativeDrop} download={file => enqueueSshDownload(tab.host.api.ssh!, tab.id, file)}
            pendingUpload={uploads.pending.find(upload => upload.id === tab.id)} />
        </div>)}
      </ResizableSidebar>
      <div className="sshw-main">
        <div className="sshw-tabs" hidden={!sessions.tabs.length}>
          <Tooltip title={t('client.ssh.savedConnections')}><button type="button" className="sshw-home-tab"
            aria-label={t('client.ssh.savedConnections')} aria-pressed={!current} onClick={() => sessions.select('')}>
            <Home size={17} /></button></Tooltip>
          <TerminalTabStrip tabs={sessions.tabs} selected={sessions.selected} select={sessions.select}
            visible={active} remove={sessions.remove} removeTabs={sessions.removeTabs} translate={t} />
          {active && <SshSessionMenu profiles={saved.profiles} canConnect={canConnect && !saved.loading}
            directory={directory} connect={connect} create={create} />}
        </div>
        {active && !current && <div className="sshw-home"><div className="sshw-launch">
          <span className="sshw-hero-icon"><Terminal size={30} /></span>
          <h2>{t('client.ssh.connection')}</h2><p>{t('client.ssh.createHint')}</p>
          <Button type="primary" icon={<Plus size={15} />} onClick={create}>{t('client.ssh.createTitle')}</Button>
          {(recentProfiles.length > 0 || saved.profiles.length > 0) && <div className="sshw-quick">
            <h3>{t(recentProfiles.length ? 'client.chat.recent' : 'client.ssh.savedConnections')}</h3>
            <div>{(recentProfiles.length ? recentProfiles : saved.profiles.slice(0, 6)).map(profile => computerMenu(profile,
              <button type="button" disabled={!canConnect}>
                <KeyRound size={15} /><span><strong>{profile.name || profile.host}</strong>
                  <small>{sshLabel(profile)}</small></span><ArrowUpRight size={14} />
              </button>))}</div></div>}
        </div></div>}
        <div className="sshw-console" hidden={!current}>
          {sessions.tabs.map(tab => <TerminalPane key={tab.id} tab={tab} api={tab.host.api} translate={t}
            visible={active && tab.id === current?.id} shortcuts={false} darkScreen onExit={() => sessions.exited(tab.id)}
            upload={batch => { setFiles(true); return uploads.enqueue(tab.id, batch); }}
            uploadPending={uploads.pending.some(upload => upload.id === tab.id)} />)}
        </div>
        {current && <ServerMonitor key={current.id} id={current.id} api={current.host.api.ssh!}
          enabled={active && !!directory.get(current.host.deviceId)?.ready && !current.exited} />}
      </div>
    </div>
    {active && editor?.kind === 'remove' && <SshRemoveProfileDialog profile={editor.profile}
      remove={saved.remove} close={closeDialog} />}
    {active && editor && editor.kind !== 'remove' && <SshConnectionDialog key={editor.profile?.id ?? editor.kind}
      api={ssh} projectCwd={SSH_WORKSPACE} initial={editor.profile} manage={editor.kind === 'manage'}
      settingsOnly={editor.kind === 'edit' || (editor.kind === 'new' && !available)} allowConnect={available && !limit}
      connected={adopt} dispose={api.close} changed={() => void saved.refresh()} close={closeDialog} />}
    {active && connecting && <SshLaunchDialog key={connecting.device.deviceId} profile={connecting.profile}
      chosen={connecting.device} choose={device => connect(connecting.profile, device)}
      directory={directory} projectCwd={SSH_WORKSPACE}
      connected={adopt} close={closeDialog} />}
  </section>;
}
