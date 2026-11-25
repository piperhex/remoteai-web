import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { ChatTools } from '../src/chat/ChatTools';
import { GuiToolbox } from '../../../shared/conversation/GuiToolbox';
import { GuiRemoteDesktop } from '../../../shared/conversation/GuiRemoteDesktop';
import { RemoteDesktop } from '../../../shared/remote-desktop/views/RemoteDesktop';
import { client, desktopTest } from './remote-desktop-fixture';
import { RemoteDesktopComputersHarness } from './remote-desktop-computers-harness';
import { DeviceScreenHarness } from './remote-desktop-device-screen-harness';
import { RetainedToolsHarness } from './remote-desktop-retained-tools-harness';
import '../src/styles.css';
import '../../../shared/remote-chat/views/chat.css';
import '../../desktop/src/pages/codexGui/remote/remoteGui.less';

// Let a desktop browser inspect the mobile controls without changing production pointer detection.
if (new URLSearchParams(location.search).has('touch')) {
  const matchMedia = window.matchMedia.bind(window);
  window.matchMedia = query => {
    const media = matchMedia(query);
    if (query === '(any-pointer: fine)') Object.defineProperty(media, 'matches', { value: false });
    return media;
  };
}

function Harness() {
  const [connected, setConnected] = useState(true);
  return <main style={{ padding: 24 }}><h1>电脑工具</h1>
    <button id="disconnect-chat" onClick={() => setConnected(false)}>模拟聊天连接中断</button>
    <button id="disconnect-host" onClick={() => { setConnected(false); desktopTest.disconnect(); }}>模拟电脑离线</button>
    <button id="reconnect-host" onClick={() => { desktopTest.reconnect(); setConnected(true); }}>模拟电脑上线</button>
    {new URLSearchParams(location.search).has('native-clipboard')
      ? <section className="gui-remote-workspace chat-page" style={{ display: 'block', height: 'auto' }}>
        <header className="chat-header">
          <div className="chat-grow"><h2>远程对话</h2>
            <GuiRemoteDesktop client={client.desktop} active connected={connected} />
            <div className="chat-connection-info">Windows · Relay</div>
          </div>
          <GuiToolbox git={client.git} cwd="C:/workspace" active
            connected={connected} />
        </header>
      </section>
      : <ChatTools client={client} cwd="C:/workspace" active connected={connected} deviceName="Windows 测试电脑"
        desktopActions={params.has('wide-tools') ? <span /> : undefined} />}
    <input aria-label="本机聊天消息" />
  </main>;
}
const params = new URLSearchParams(location.search);
function EmbeddedViewer() {
  const [open, setOpen] = useState(true);
  return <main style={{ position: 'absolute', inset: '64px 0 0 200px', overflow: 'hidden' }}>
    {open && <RemoteDesktop embedded active client={client.desktop} close={() => setOpen(false)} />}
  </main>;
}

createRoot(document.getElementById('root')!).render(params.has('device-screen') ? <DeviceScreenHarness />
  : params.has('embedded') ? <EmbeddedViewer />
  : params.has('retained-tools') ? <RetainedToolsHarness />
  : params.has('computers') ? <RemoteDesktopComputersHarness /> : <Harness />);
