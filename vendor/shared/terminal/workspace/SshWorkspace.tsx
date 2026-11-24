import { useEffect, useState, type ReactNode } from 'react';
import { Alert, Button, Tooltip } from 'antd';
import { ArrowUpRight, FolderTree, Home, KeyRound, Monitor, Plus, RefreshCw, Server, Settings2, Terminal } from 'lucide-react';
import { displayText as t } from '../../localization/messages';
import { remoteErrorText } from '../../localization/errors';
import { useGuiLanguage } from '../../localization/useGuiLanguage';
import { enqueueSshDownload } from '../../downloads/sshDownload';
import { SshConnectionDialog } from '../SshConnectionDialog';
import { SshQuickConnectDialog } from '../SshQuickConnectDialog';
import { SshProjectBrowser } from '../SshProjectBrowser';
import { SshProfileList } from '../SshProfileList';
import { sshLabel, type SshProfile } from '../sshProfiles';
import { useSshProfiles } from '../useSshProfiles';
import { useSshDropQueue } from '../useSshDropQueue';
import { TerminalTabStrip } from '../views/TerminalTabStrip';
import { TerminalPane, nativeDrop } from '../views/TerminalPanel';
import { MAX_TERMINAL_TABS } from '../views/useTerminalPanel';
import type { TerminalApi, TerminalInfo } from '../types';
import { useRecentSshProfiles, useSshSessions } from './useSshSessions';
import { ServerMonitor } from './ServerMonitor';
import './workspace.css';

interface Props {
  api: TerminalApi; active: boolean; available: boolean; scope: string; host: ReactNode; login?: () => void;
}

// The remote terminal list uses this opaque project association to isolate SSH tabs from chat terminals.
const SSH_WORKSPACE = 'remoteai:ssh-workspace';

export function SshWorkspace({ api, active, available, scope, host, login }: Props) {
  useGuiLanguage();
  const ssh = api.ssh!;
  const saved = useSshProfiles(ssh.profiles, active);
  const sessions = useSshSessions(api);
  const recent = useRecentSshProfiles(scope);
  const uploads = useSshDropQueue(sessions.tabs.map(tab => tab.id));
  const [editor, setEditor] = useState<'new' | 'manage'>();
  const [connecting, setConnecting] = useState<SshProfile>();
  const [files, setFiles] = useState(true);
  useEffect(() => { if (!active) { setEditor(undefined); setConnecting(undefined); } }, [active]);
  useEffect(() => { if (!available) setConnecting(undefined); }, [available]);
  const current = sessions.tabs.find(tab => tab.id === sessions.selected);
  const limit = sessions.tabs.length >= MAX_TERMINAL_TABS;
  const canConnect = available && !limit && !saved.error;
  const closeDialog = () => { setEditor(undefined); setConnecting(undefined); };
  const adopt = (info: TerminalInfo) => {
    sessions.adopt(info);
    const profile = connecting ?? saved.profiles.find(p => info.ssh && sshLabel(p) === sshLabel(info.ssh));
    if (profile) recent.remember(profile.id);
    setFiles(true);
  };
  const choose = (profile?: SshProfile) => {
    if (login) { login(); return; }
    if (!profile) { setEditor('new'); return; }
    if (canConnect) setConnecting(profile);
  };
  const recentProfiles = recent.ids.flatMap(id => saved.profiles.find(p => p.id === id) ?? []);
  const showFiles = Boolean(current && files);
  return <section className="ssh-workspace" aria-label={t('client.discovery.ssh')} hidden={!active}>
    <header className="sshw-header"><span className="sshw-mark"><Terminal size={20} /></span>
      <h1>{t('client.discovery.ssh')}</h1><div className="sshw-host"><Monitor size={14} />{host}</div>
      <div className="sshw-tools">
        <Tooltip title={t('client.ssh.refresh')}><Button aria-label={t('client.ssh.refresh')}
          icon={<RefreshCw size={15} />} loading={saved.loading} onClick={() => void saved.refresh()} /></Tooltip>
        <Button icon={<Settings2 size={15} />} onClick={() => login ? login() : setEditor('manage')}>
          {t('client.ssh.manage')}</Button>
      </div>
    </header>
    {(saved.error || sessions.error || !available || limit) && <Alert type="warning" showIcon
      message={remoteErrorText(saved.error || sessions.error || (limit ? 'client.ssh.limit' : 'client.discovery.sshComputerHint'))}
      action={login && <Button onClick={login}>{t('client.lounge.login')}</Button>} />}
    <div className="sshw-body">
      <div className="sshw-rail">
        {current && <div className="sshw-switch">
          <button type="button" aria-label={t('client.ssh.savedConnections')} aria-pressed={!files}
            onClick={() => setFiles(false)}><Server size={15} />{t('client.ssh.savedConnection')}</button>
          <button type="button" aria-label={t('client.ssh.files')} aria-pressed={files}
            onClick={() => setFiles(true)}><FolderTree size={15} />{t('client.chat.files.39932f')}</button>
        </div>}
        <div className="sshw-profiles" hidden={showFiles}>
          <SshProfileList profiles={saved.profiles} disabled={saved.loading || !canConnect} loading={saved.loading} showNew={false}
            choose={choose} selected={connecting} />
        </div>
        {sessions.tabs.map(tab => <div className="sshw-files" key={tab.id} hidden={!showFiles || tab.id !== current?.id}>
          <SshProjectBrowser id={tab.id} api={ssh} active={active && showFiles && tab.id === current?.id}
            nativeDrop={nativeDrop} download={file => enqueueSshDownload(ssh, tab.id, file)}
            pendingUpload={uploads.pending.find(upload => upload.id === tab.id)} />
        </div>)}
      </div>
      <div className="sshw-main">
        <div className="sshw-tabs" hidden={!sessions.tabs.length}>
          <Tooltip title={t('client.ssh.savedConnections')}><button type="button" className="sshw-home-tab"
            aria-label={t('client.ssh.savedConnections')} aria-pressed={!current} onClick={() => sessions.select('')}>
            <Home size={17} /></button></Tooltip>
          <TerminalTabStrip tabs={sessions.tabs} selected={sessions.selected} select={sessions.select}
            visible={active} remove={sessions.remove} removeTabs={sessions.removeTabs} translate={t} />
          <Tooltip title={t('client.ssh.createTitle')}><Button type="text" icon={<Plus size={15} />}
            aria-label={t('client.ssh.createTitle')} onClick={() => choose()} /></Tooltip>
        </div>
        {!current && <div className="sshw-home"><div className="sshw-launch">
          <span className="sshw-hero-icon"><Terminal size={30} /></span>
          <h2>{t('client.ssh.connection')}</h2><p>{t('client.ssh.createHint')}</p>
          <Button type="primary" icon={<Plus size={15} />} onClick={() => choose()}>{t('client.ssh.createTitle')}</Button>
          {(recentProfiles.length > 0 || saved.profiles.length > 0) && <div className="sshw-quick">
            <h3>{t(recentProfiles.length ? 'client.chat.recent' : 'client.ssh.savedConnections')}</h3>
            <div>{(recentProfiles.length ? recentProfiles : saved.profiles.slice(0, 6)).map(profile =>
              <button key={profile.id} onClick={() => choose(profile)} disabled={!canConnect}>
                <KeyRound size={15} /><span><strong>{profile.name || profile.host}</strong>
                  <small>{sshLabel(profile)}</small></span><ArrowUpRight size={14} />
              </button>)}</div></div>}
        </div></div>}
        <div className="sshw-console" hidden={!current}>
          {sessions.tabs.map(tab => <TerminalPane key={tab.id} tab={tab} api={api} translate={t}
            visible={active && tab.id === current?.id} shortcuts={false} darkScreen onExit={() => sessions.exited(tab.id)}
            upload={batch => { setFiles(true); return uploads.enqueue(tab.id, batch); }}
            uploadPending={uploads.pending.some(upload => upload.id === tab.id)} />)}
        </div>
        {current && <ServerMonitor key={current.id} id={current.id} api={ssh}
          enabled={active && available && !current.exited} />}
      </div>
    </div>
    {active && editor && <SshConnectionDialog key={editor} api={ssh} projectCwd={SSH_WORKSPACE} manage={editor === 'manage'}
      settingsOnly={editor === 'new' && !available} allowConnect={available && !limit}
      connected={adopt} dispose={api.close} changed={() => void saved.refresh()} close={closeDialog} />}
    {active && connecting && available && <SshQuickConnectDialog api={ssh} profile={connecting} projectCwd={SSH_WORKSPACE}
      connected={adopt} dispose={api.close} close={closeDialog} />}
  </section>;
}
