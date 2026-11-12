"use client";

import { useEffect, useState } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { BottomNav } from "./BottomNav";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { BadgeKey } from "./nav-items";

type AppShellProps = {
  userName: string;
  badges: Record<BadgeKey, number>;
  children: React.ReactNode;
};

const COLLAPSE_KEY = "sidebar-collapsed";

/**
 * غلاف التطبيق المشترك: سايدبار كحلي قابل للطي (حالته في localStorage)،
 * شريط علوي بزر رجوع وbreadcrumbs، وتنقل سفلي على الموبايل.
 */
export function AppShell({ userName, badges, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  // استرجاع الحالة المحفوظة بعد التركيب فقط — تجنّباً لعدم تطابق الترطيب.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      window.localStorage.setItem(COLLAPSE_KEY, prev ? "0" : "1");
      return !prev;
    });
  }

  return (
    <ToastProvider>
      <Sidebar
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        userName={userName}
        badges={badges}
      />
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-200",
          collapsed ? "md:ps-16" : "md:ps-60",
        )}
      >
        <Topbar />
        <main className="flex-1 pb-20 md:pb-8">{children}</main>
      </div>
      <BottomNav badges={badges} />
    </ToastProvider>
  );
}
