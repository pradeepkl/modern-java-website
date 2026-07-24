import type { LucideIcon } from 'lucide-react';
import './ModalStatusIcon.css';

/** Lucide size inside the circular badge — shared by all checkout/waitlist modals. */
export const MODAL_STATUS_ICON_SIZE = 28;

/** Close (X) control size — shared by all modals. */
export const MODAL_CLOSE_ICON_SIZE = 22;

/** Primary CTA icons (pay, notify, download) inside modal buttons. */
export const MODAL_ACTION_ICON_SIZE = 18;

interface ModalStatusIconProps {
  icon: LucideIcon;
  className?: string;
}

export function ModalStatusIcon({ icon: Icon, className }: ModalStatusIconProps) {
  return (
    <span
      className={
        className ? `modal-status-icon ${className}` : 'modal-status-icon'
      }
      aria-hidden="true"
    >
      <Icon size={MODAL_STATUS_ICON_SIZE} strokeWidth={1.75} />
    </span>
  );
}
