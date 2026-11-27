"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

/**
 * بوابة دخول لوحة إدارة المنصة — كلمة سر المنصة سر مستقل عن حسابات العيادات.
 * النجاح يصدر كوكي الجلسة الإدارية ويعيد تحميل اللوحة.
 */
export function AdminLogin() {
  const { t } = useI18n();
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? t("errors.loginFailed"));
        return;
      }
      router.refresh();
    } catch {
      setError(t("errors.offline"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-sunken px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-card border border-warm-200 bg-surface-raised p-8 shadow-sm"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span
            aria-hidden
            className="grid size-12 place-items-center rounded-full bg-ink-900 text-primary-100"
          >
            <LockKeyhole size={22} />
          </span>
          <h1 className="font-display text-xl font-normal text-ink-900">
            {t("admin.platformBoard")}
          </h1>
          <p className="text-sm text-steel-600">
            {t("admin.enterPassword")}
          </p>
        </div>

        <div className="mt-6">
          <Field label={t("admin.platformPassword")} htmlFor="admin-key">
            <Input
              id="admin-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger-600">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting || !key} className="mt-5 w-full">
          {submitting ? t("auth.signingIn") : t("admin.login")}
        </Button>
      </form>
    </main>
  );
}
