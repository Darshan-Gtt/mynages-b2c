import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from '../../lib/utils';

/** Overlays render inside the app frame (phone frame on desktop), so sheets slide up within the "phone". */
const target = () => document.getElementById('app-frame') ?? document.body;

function useLock(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open, onClose]);
}

/** Bottom sheet (PRD §7.3.3: every quick action opens a bottom sheet and returns to the same page). */
export function Sheet({ open, onClose, title, subtitle, children, footer, full }: {
  open: boolean; onClose: () => void; title?: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; full?: boolean;
}) {
  useLock(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="sheet-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('sheet', full && 'full')} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="sheet-grip" aria-hidden="true" />
        {title && (
          <div className="sheet-head">
            <div className="grow" style={{ minWidth: 0 }}>
              <h3>{title}</h3>
              {subtitle && <p className="xs muted">{subtitle}</p>}
            </div>
            <button className="close-btn" onClick={onClose} aria-label="Close"><X size={17} /></button>
          </div>
        )}
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    target(),
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useLock(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true">
        {title && <h3 style={{ marginBottom: 8 }}>{title}</h3>}
        {children}
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>,
    target(),
  );
}

export function Confirm({ open, title, message, confirmLabel = 'Delete', danger = true, onConfirm, onClose }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className={cx('btn', danger ? 'btn-danger' : 'btn-primary')} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button></>}>
      <p className="small muted">{message}</p>
    </Modal>
  );
}

export interface SheetAction { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean; hidden?: boolean; sub?: string }
/** iOS/Android-style action sheet for row actions on mobile. */
export function ActionSheet({ open, onClose, title, actions }: { open: boolean; onClose: () => void; title?: string; actions: SheetAction[] }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="action-list">
        {actions.filter((a) => !a.hidden).map((a) => (
          <button key={a.label} className={cx('action-item', a.danger && 'danger')} onClick={() => { onClose(); a.onClick(); }}>
            {a.icon}<span className="grow">{a.label}{a.sub && <em>{a.sub}</em>}</span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
