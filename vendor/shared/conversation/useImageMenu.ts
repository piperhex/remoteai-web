import { uiText } from "../localization/uiText";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { Menu } from "@tauri-apps/api/menu";

type ImageAction = "copy" | "saveAs";

export function useImageMenu(prepare?: (url: string) => Promise<string>) {
  const [feedback, setFeedback] = useState("");
  const selected = useRef<{ current: () => string | undefined; original?: string }>();
  const busy = useRef(false);
  const menus = useRef(new Map<boolean, Promise<Menu>>());
  useEffect(() => () => {
    // Popup completion does not mean the native menu resource can be released on every platform.
    for (const menu of menus.current.values()) {
      void menu.then(value => value.close()).catch(() => console.warn("Could not release image menu"));
    }
  }, []);

  const perform = async (action: ImageAction) => {
    const source = action === 'copy' ? selected.current?.current() : selected.current?.original;
    if (!source || busy.current) return;
    busy.current = true;
    setFeedback(action === "copy" ? uiText("client.workspaceActions.copyingImage") : uiText("client.workspaceActions.preparingToSave"));
    try {
      const result = await invoke<{ completed: boolean }>("codex_gui_image_action", {
        request: { source: prepare ? await prepare(source) : source, action },
      });
      setFeedback(result.completed ? (action === "copy" ? uiText("client.workspaceActions.imageCopied") : uiText("client.workspaceActions.imageSaved")) : "");
    } catch {
      setFeedback(action === "copy" ? uiText("client.workspaceActions.couldNotCopyTheImagePleaseTryAgain") : uiText("client.workspaceActions.couldNotSaveTheImagePleaseTryAgain"));
    } finally { busy.current = false; }
  };

  const open = (event: MouseEvent, current: () => string | undefined, original?: string) => {
    event.preventDefault();
    if (busy.current) return;
    setFeedback('');
    selected.current = { current, original };
    const canSave = Boolean(original);
    const position = new LogicalPosition(event.clientX, event.clientY);
    const menu = menus.current.get(canSave) ?? Menu.new({ items: [
      { text: uiText("client.workspaceActions.copyImage"), action: () => { void perform("copy"); } },
      ...(canSave ? [{ text: uiText("client.composer.saveAs"), action: () => { void perform("saveAs"); } }] : []),
    ] }).catch((error: unknown) => { menus.current.delete(canSave); throw error; });
    menus.current.set(canSave, menu);
    void menu.then((value) => value.popup(position))
      .catch(() => setFeedback(uiText("client.workspaceActions.couldNotOpenTheMenuPleaseTryAgain")));
  };
  return { feedback, contextMenu: isTauri() ? open : undefined };
}
