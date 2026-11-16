import { DesktopHostSession } from './session';

/** A synthetic remote computer for browser integration tests, never imported by production entry points. */
export class HostSession extends DesktopHostSession {
  override async open() {
    return { ...await super.open(), capabilities: { keyboard: true, control: true, inputFocus: true,
      clipboardNative: true, clipboardFiles: false, clipboard: true, horizontalScroll: true,
      security: false, privacyScreen: false, resolution: false } };
  }
}
