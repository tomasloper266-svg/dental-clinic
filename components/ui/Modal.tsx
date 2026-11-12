"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "./cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** أزرار/إجراءات أسفل النافذة */
  footer?: React.ReactNode;
  className?: string;
};

/** نافذة حوارية — إغلاق بـ Escape أو بالنقر على الخلفية، بتركيز داخل الحوار */
export function Modal({ open, onClose, title, children, footer, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "w-full max-w-lg rounded-panel border border-warm-200 bg-surface-raised shadow-lg outline-none",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-warm-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-field p-1 text-warm-500 hover:bg-surface-hover hover:text-ink-900"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 text-sm">
          {children}
        </div>
        {footer && (
          <div className="flex justify-start gap-2 border-t border-warm-200 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
