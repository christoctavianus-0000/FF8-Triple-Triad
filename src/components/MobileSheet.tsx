import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface MobileSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

export const MobileSheet: React.FC<MobileSheetProps> = ({
  open,
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="tt-sheet-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className={`tt-window tt-sheet-panel ${wide ? 'tt-sheet-panel--wide' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tt-sheet-header">
          <div>
            <h2 className="tt-sheet-title">{title}</h2>
            {subtitle && <p className="tt-sheet-subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="tt-icon-btn"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="tt-sheet-body">{children}</div>
      </div>
    </div>
  );
};
