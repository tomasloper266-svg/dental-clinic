"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

export function WelcomeCard({ clinicName }: { clinicName: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xl font-semibold">
        {t("landing.welcomeTo")} {clinicName}
      </p>
      <p className="mt-2 text-sm text-neutral-500">{t("dashboard.placeholder")}</p>
    </div>
  );
}
