"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "./cn";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
};

/**
 * لوحة جانبية من جهة بداية السطر (يمين في RTL) — بديل النوافذ المتكررة
 * لعرض تفاصيل عنصر (سنة أودوغرام، مريض) دون فقدان السياق.
 */
export function Drawer({ open, onClose, title, children, footer, className }: DrawerProps) {
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
      className="fixed inset-0 z-50 bg-ink-950/45 backdrop-blur-sm"
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
          "absolute inset-y-0 start-0 flex w-full max-w-sm flex-col rounded-e-panel bg-surface-raised shadow-lg outline-none",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-warm-200/60 px-5 py-3">
          <h2 className="text-base font-bold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-full p-1.5 text-warm-500 hover:bg-surface-hover hover:text-ink-900"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
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
