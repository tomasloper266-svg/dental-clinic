"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "./cn";

export type ToastTone = "success" | "danger" | "info";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  /** يعرض إشعاراً عابراً (4 ثوان) في أسفل الشاشة */
  toast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClasses: Record<ToastTone, string> = {
  success: "border-primary-200 bg-primary-50 text-primary-800",
  danger: "border-danger-300 bg-danger-50 text-danger-700",
  info: "border-warm-200 bg-surface-raised text-ink-900",
};

/** الوصول إلى الإشعارات — يتطلب تغليف الشجرة بـ ToastProvider */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed start-1/2 bottom-4 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 rtl:translate-x-1/2"
      >
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              "rounded-field pointer-events-auto border px-4 py-2.5 text-sm shadow-md",
              toneClasses[item.tone],
            )}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
