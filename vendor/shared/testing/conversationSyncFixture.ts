import type { SyncHost, SyncRequest } from '../conversation/sync/types';

const thread = { sessionId: 'thread-sync', sessionKind: 'conversation', title: '排查项目中的登录问题',
  cwd: 'F:/projects/remoteai', updatedAt: 1_799_999_000, sizeBytes: 512 * 1024, matchExcerpt: null };

function fixtureThreads(parameters: URLSearchParams) {
  const project = parameters.has('wrapping') ? { ...thread,
    cwd: 'F:/projects/customer-workspaces/remoteai-long-running-conversation-synchronization-regression-project',
  } : thread;
  const scratchRoot = 'C:/Users/Codex/AppData/Roaming/dev.codex.switch/codex-gui-workspaces';
  if (parameters.has('externalProjects')) return [
    { ...thread, sessionId: 'official', title: '普通 Codex 中的临时对话', updatedAt: thread.updatedAt + 4,
      cwd: String.raw`\\?\C:\Users\ZH\Documents\Codex\2026-10-10\ce` },
    { ...thread, sessionId: 'explicit-recent', title: '已移出项目的对话', updatedAt: thread.updatedAt + 3,
      cwd: 'D:/old-project', projectPath: '' },
    { ...thread, sessionId: 'named-project', title: '检查客户登录流程', updatedAt: thread.updatedAt + 2,
      cwd: String.raw`\\?\D:\clients\portal\src`, projectPath: String.raw`\\?\D:\clients\portal`,
      projectName: '客户门户' },
    { ...thread, sessionId: 'equivalent-path', title: '完善客户设置页面', updatedAt: thread.updatedAt + 1,
      cwd: 'd:/clients/PORTAL/', projectPath: 'd:/clients/PORTAL/' },
    { ...thread, sessionId: 'old-host-project', title: '复查桌面同步功能',
      cwd: String.raw`\\?\D:\github\codex-switch` },
  ];
  if (parameters.has('regression')) return [
    { ...thread, sessionId: 'copy', title: '同名对话', cwd: '', updatedAt: thread.updatedAt + 5 },
    { ...thread, sessionId: 'copy', title: '同名对话', cwd: 'F:/outdated-project', updatedAt: thread.updatedAt },
    { ...thread, sessionId: 'same-title', title: '同名对话', cwd: '', updatedAt: thread.updatedAt + 4 },
    { ...thread, sessionId: 'external-projectless', title: '普通目录中的非项目对话', cwd: '',
      sessionKind: 'external', updatedAt: thread.updatedAt + 3 },
    { ...thread, sessionId: 'scratch', title: '临时工作区对话', cwd: `${scratchRoot}/0300e13d-5059-40fe-925f-53e639c4f0cb`,
      updatedAt: thread.updatedAt + 2 },
    ...Array.from({ length: 3000 }, (_, index) => ({ ...thread, sessionId: `large-${index}`,
      title: `批量项目对话 ${index + 1}`, updatedAt: thread.updatedAt - index })),
  ];
  if (parameters.has('projectless')) return [project,
    { ...thread, sessionId: 'scratch-windows', title: '整理本周工作计划', updatedAt: thread.updatedAt + 3,
      cwd: `${scratchRoot}/0300e13d-5059-40fe-925f-53e639c4f0cb`.replaceAll('/', '\\') },
    { ...thread, sessionId: 'scratch-unix', title: '准备周末出行清单', updatedAt: thread.updatedAt + 2,
      cwd: '/home/demo/.local/share/dev.codex.switch/codex-gui-workspaces/5f964d75-8a1d-48ec-9a5f-6ebee593fe53' },
    { ...thread, sessionId: 'no-project', title: '临时对话', cwd: '', updatedAt: thread.updatedAt + 1 },
    { ...thread, sessionId: 'untitled', title: '', cwd: '', updatedAt: null },
  ];
  if (!parameters.has('grouped')) return [project];
  return [project,
    ...Array.from({ length: 64 }, (_, index) => ({ ...thread, sessionId: `thread-${index}`,
      title: `项目对话 ${index + 1}`, updatedAt: thread.updatedAt - index - 1,
      sessionKind: index === 0 ? 'external' : 'conversation' })),
    { ...thread, sessionId: 'other-project', title: '整理第二个项目', cwd: 'D:/clients/remoteai',
      updatedAt: thread.updatedAt - 100 },
    { ...thread, sessionId: 'no-project', title: '临时对话', cwd: '', updatedAt: null },
  ];
}

export function conversationSyncFixture(parameters: URLSearchParams) {
  const calls: { host: string; request: SyncRequest }[] = [];
  let mode = parameters.get('path') === 'direct' ? 'direct' as const : 'relay' as const;
  let written = 0;
  let released = false;
  const waiters = new Set<() => void>();
  const release = () => { released = true; waiters.forEach(resolve => resolve()); waiters.clear(); };
  const threads = fixtureThreads(parameters);
  const duplicates = parameters.has('duplicates') ? [thread.sessionId] : [];
  const remote = parameters.get('mode') !== 'local';
  const directory = (source: boolean) => ({ name: source ? 'Office PC' : 'My PC', homes: [
    ...(!source && remote ? [] : [{ id: 'default', path: source ? 'D:/work/.codex' : 'C:/Users/demo/.codex',
      enabled: true }]),
    ...(parameters.has('previousHome') ? [{ id: 'previous:fixture',
      path: 'D:/AgentHub/Archive/.codex', enabled: false }] : []),
    { id: parameters.has('guiPath') ? 'custom-gui' : 'codex-gui', path: parameters.has('guiPath')
      ? 'C:/Users/demo/AppData/Roaming/dev.codex.switch/.codex'
      : source ? 'D:/Remote AI/.codex' : 'C:/Remote AI/.codex', enabled: false },
  ] });
  const request = (id: string) => async <T>(request: SyncRequest): Promise<T> => {
    calls.push({ host: id, request });
    let result: unknown = {};
    if (request.action === 'homes') result = directory(id === 'source');
    if (request.action === 'list') result = threads.filter(item => item.title.includes(request.query ?? ''));
    if (['prepare', 'export', 'begin', 'resume'].includes(request.action)) result = { id: `transfer-${id}`,
      size: 512 * 1024, originalSize: 2 * 1024 * 1024, chunkBytes: 128 * 1024,
      resumeToken: 'resume-' + id, written: id === 'source' ? 512 * 1024 : written,
      sha256: 'a'.repeat(64), sessionIds: [thread.sessionId] };
    if (request.action === 'read') {
      if (parameters.has('hold') && request.offset >= 96 * 1024 && !released) {
        await new Promise<void>(resolve => { waiters.add(resolve); });
      }
      await new Promise(resolve => setTimeout(resolve, mode === 'relay' ? 70 : 15));
      const length = Math.min(request.length ?? 12 * 1024, 512 * 1024 - request.offset);
      result = { data: btoa('a'.repeat(length)) };
    }
    if (request.action === 'write') {
      await new Promise(resolve => setTimeout(resolve, mode === 'relay' ? 100 : 40));
      if (parameters.has('switchPath') && request.offset >= 128 * 1024) mode = 'direct';
      written = request.offset + atob(request.data).length; result = { written };
    }
    if (request.action === 'plan') result = { count: 1, duplicateIds: duplicates };
    if (request.action === 'commit') result = { completedCount: duplicates.length && !request.overwriteIds.length ? 0 : 1,
      skippedCount: duplicates.length && !request.overwriteIds.length ? 1 : 0 };
    return result as T;
  };
  const destination: SyncHost = { id: 'target', name: 'My PC', request: request('target') };
  const source: SyncHost = { id: 'source', name: 'Office PC', request: request('source'), mode: () => mode };
  return { hosts: remote ? [destination, source] : [destination], destination, calls, release };
}
