import { useContext, useEffect, useRef, useState } from 'react';
import { BrowserClientContext } from '../../file-preview/workspace/browserClient';
import type { PanelCommand } from './model';
import { command } from './transfer';

export function usePanelTransport(extension: string | undefined) {
  const client = useContext(BrowserClientContext);
  const [state, setState] = useState({ session: '', ready: false, panelActivity: false, failed: false });
  const current = useRef<{ session: string; open: Promise<unknown>; closed: boolean }>();
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    const session = crypto.randomUUID();
    setState({ session, ready: false, panelActivity: false, failed: false });
    const open = command(client, { action: 'panel', session, command: { action: 'open', extension } });
    const instance = { session, open, closed: false }; current.current = instance;
    void open.then(reply => {
      if (!instance.closed) setState({ session, ready: true, panelActivity: reply.panelActivity === true, failed: false });
    }).catch(() => { if (!instance.closed) setState({ session, ready: false, panelActivity: false, failed: true }); });
    return () => {
      instance.closed = true;
      // Close even after an uncertain open response; the session ID is unique to this panel.
      void open.catch(() => {}).then(() => command(client, { action: 'panel', session, command: { action: 'close' } }))
        .catch(() => command(client, { action: 'panel', session, command: { action: 'close' } }))
        .catch(error => console.warn('Browser panel cleanup failed', error));
    };
  }, [client, extension]);
  const request = async (input: PanelCommand) => {
    const instance = current.current;
    if (!instance || instance.closed) throw new Error('Browser panel unavailable');
    await instance.open;
    if (instance.closed) throw new Error('Browser panel closed');
    return command(client, { action: 'panel', session: instance.session, command: input });
  };
  const send = (input: PanelCommand) => {
    const instance = current.current;
    queue.current = queue.current.then(() => {
      if (current.current !== instance || instance?.closed) return;
      return request(input);
    }).then(() => {}).catch(() => {
      if (current.current === instance && !instance?.closed) setState(value => ({ ...value, failed: true }));
    });
  };
  return { ...state, native: client.native, request, send };
}
