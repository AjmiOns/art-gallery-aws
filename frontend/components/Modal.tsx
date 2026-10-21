'use client';

import { useEffect, useRef } from 'react';

// Fenêtre modale native (<dialog>) : focus piégé et fermeture par Échap gérés par le navigateur.
export default function Modal({ open, onClose, title, children, wide = false }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className={`modal${wide ? ' modal--wide' : ''}`} aria-label={title} onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()}>
      {open && (
        <div className="modal__body">
          <header className="modal__head">
            <h2>{title}</h2>
            <button type="button" className="dialog__close" onClick={onClose} aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
