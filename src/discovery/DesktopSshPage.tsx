import { useRef } from 'react';
import { SshWorkspace } from '../../../../shared/terminal/workspace/SshWorkspace';
import type { SshHost } from '../../../../shared/terminal/workspace/useSshHosts';
import type { SshHostDirectory } from '../../../../shared/terminal/workspace/SshLaunchDialog';

export default function DesktopSshPage({ active, scope, defaultHost, directory }: {
  active: boolean; scope: string; defaultHost?: SshHost; directory: SshHostDirectory;
}) {
  // A newly selected chat reports its API after mounting. Keep the account's open SSH tabs during that render.
  const previous = useRef<SshHost>();
  if (defaultHost) previous.current = defaultHost;
  const host = defaultHost ?? (previous.current && { ...previous.current, ready: false });
  return host && <SshWorkspace active={active} scope={scope} defaultHost={host} directory={directory} />;
}
