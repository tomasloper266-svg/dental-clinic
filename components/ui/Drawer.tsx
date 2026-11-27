"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
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
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: DrawerProps) {
  const { t } = useI18n();
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
      className="bg-ink-950/45 fixed inset-0 z-50 backdrop-blur-sm"
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
          "rounded-e-panel bg-surface-raised absolute inset-y-0 start-0 flex w-full max-w-sm flex-col shadow-lg outline-none",
          className,
        )}
      >
        <div className="border-warm-200/60 flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-ink-900 text-base font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="text-warm-500 hover:bg-surface-hover hover:text-ink-900 rounded-full p-1.5"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
          {children}
        </div>
        {footer && (
          <div className="border-warm-200 flex justify-start gap-2 border-t px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
