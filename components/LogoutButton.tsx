"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton({
  className,
}: {
  className?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onLogout() {
    setSubmitting(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={submitting}
      className={
        className ??
        "mt-6 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
      }
    >
      {submitting ? t("subscription.loggingOut") : t("subscription.logout")}
    </button>
  );
}
