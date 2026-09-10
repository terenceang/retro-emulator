/**
 * The Apple II keyboard is a simple ASCII latch (unlike the ZX Spectrum's row/bit
 * matrix), so mapping a browser KeyEvent down to it is much simpler: special keys
 * get a fixed control code, everything else uses the browser's own `e.key` (which
 * already accounts for Shift) as a literal ASCII character.
 */
import { SPECIAL_KEY_CODES } from "@apple2/core";

/** Matches a plain latin letter in `e.key`, whatever the host caps/shift state made it. */
const LETTER_KEY = /^[a-zA-Z]$/;

export function keyEventToAscii(e: KeyboardEvent, capsLockDown: boolean): number | null {
  if (e.ctrlKey && e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
    return e.key.toUpperCase().charCodeAt(0) & 0x1f;
  }
  const special = SPECIAL_KEY_CODES[e.code];
  if (special !== undefined) return special;
  if (LETTER_KEY.test(e.key)) {
    // The IIe caps switch is keyboard hardware: letters latch lowercase
    // ($61-$7A) with it up and uppercase ($41-$5A) with it down (Shift always
    // produces uppercase either way). The host's own caps-lock state is folded
    // into e.key's case, so normalize it away — the emulated switch, not the
    // host, decides the case, like the real thing.
    const upper = e.key.toUpperCase().charCodeAt(0);
    return (capsLockDown || e.shiftKey ? upper : upper + 0x20) & 0x7f;
  }
  if (e.key.length === 1) {
    return e.key.charCodeAt(0) & 0x7f;
  }
  return null;
}

export function isInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}
