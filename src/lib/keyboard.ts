/**
 * Keeps the field being typed in visible when the phone keyboard opens.
 *
 * The Android app runs edge-to-edge, where the keyboard covers the WebView instead of shrinking it. We read the
 * keyboard height (Capacitor Keyboard plugin in the app, visualViewport in a phone browser), shrink the app frame
 * by that much via the --kb CSS variable, and scroll the focused input to the middle of what is left.
 */
import { isNativeApp } from './utils';

const isField = (el: Element | null): el is HTMLElement =>
  !!el && (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'color', 'file'].includes(el.type)));

function reveal() {
  const el = document.activeElement;
  if (isField(el)) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export function setupKeyboard() {
  const root = document.documentElement;
  let fullHeight = window.innerHeight;
  let open = false;

  const apply = (kb: number) => {
    // If the system already shrank the window (adjustResize), only cover the part it didn't.
    const shrunk = Math.max(0, fullHeight - window.innerHeight);
    const pad = Math.max(0, Math.round(kb - shrunk));
    open = kb > 0;
    root.style.setProperty('--kb', `${pad}px`);
    root.classList.toggle('kb-open', open);
    if (open) { setTimeout(reveal, 80); setTimeout(reveal, 320); }
  };

  window.addEventListener('resize', () => { if (!open) fullHeight = window.innerHeight; });
  document.addEventListener('focusin', (e) => { if (isField(e.target as Element)) setTimeout(reveal, 350); });

  if (isNativeApp()) {
    import('@capacitor/keyboard').then(({ Keyboard }) => {
      Keyboard.addListener('keyboardWillShow', (i) => apply(i.keyboardHeight));
      Keyboard.addListener('keyboardDidShow', (i) => apply(i.keyboardHeight));
      Keyboard.addListener('keyboardWillHide', () => apply(0));
      Keyboard.addListener('keyboardDidHide', () => apply(0));
    }).catch(() => { /* plugin missing: fall back to focus scrolling only */ });
    return;
  }

  const vv = window.visualViewport;
  if (vv) {
    const onVv = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      apply(covered > 120 ? covered : 0);
    };
    vv.addEventListener('resize', onVv);
  }
}
