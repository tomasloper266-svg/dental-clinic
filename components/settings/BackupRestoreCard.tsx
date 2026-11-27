"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useRef, useState } from "react";
import { Download, DatabaseBackup, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";

// بطاقة «النسخ الاحتياطي والاستعادة» — نسخة تلقائية (JSON) بعد كل عملية
// تحديث (مُجمَّعة من غلاف Prisma)، وتنزيل فوري، واستعادة من ملف ببوابة
// تأكيد لأنها تستبدل البيانات الحالية. فشل الاستعادة داخل المعاملة لا
// يغيّر شيئاً في قاعدة البيانات.

type RestoreState =
  | { phase: "idle" }
  | { phase: "confirming"; file: File }
  | { phase: "restoring" }
  | { phase: "error"; message: string };

export function BackupRestoreCard() {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restore, setRestore] = useState<RestoreState>({ phase: "idle" });

  function pickFile() {
    fileInputRef.current?.click();
  }

  function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setRestore({
        phase: "error",
        message: t("api.backup.mustBeJson"),
      });
      return;
    }
    setRestore({ phase: "confirming", file });
  }

  async function onRestoreConfirmed() {
    if (restore.phase !== "confirming") return;
    const file = restore.file;
    setRestore({ phase: "restoring" });
    try {
      const snapshot = JSON.parse(await file.text());
      const res = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setRestore({
          phase: "error",
          message: data?.error ?? t("api.backup.restoreFailed"),
        });
        return;
      }
      // النجاح: البيانات استُبدلت — إعادة تحميل كاملة لكل الشاشات
      window.location.reload();
    } catch (error) {
      setRestore({
        phase: "error",
        message:
          error instanceof SyntaxError
            ? t("api.backup.notJson")
            : t("errors.serverNoChange"),
      });
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
          <DatabaseBackup size={18} className="text-primary-700" aria-hidden />
          {t("settings.backupRestore")}
        </h2>
        <p className="text-sm text-warm-600">
          {t("settings.autoBackupHint")}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => {
              window.location.href = "/api/settings/backup";
            }}
          >
            <Download size={16} aria-hidden />
            {t("settings.downloadBackup")}
          </Button>
          <Button variant="danger" onClick={pickFile}>
            <Upload size={16} aria-hidden />
            {t("settings.restoreBackup")}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={onFilePicked}
            className="hidden"
            aria-label={t("settings.chooseBackupFile")}
          />
        </div>

        {restore.phase === "error" && (
          <p
            role="alert"
            className="rounded-field border border-danger-100 bg-danger-50 px-3 py-2.5 text-sm text-danger-700"
          >
            {restore.message}
          </p>
        )}

        <Modal
          open={restore.phase === "confirming"}
          onClose={() => setRestore({ phase: "idle" })}
          title={t("settings.restoreConfirmTitle")}
        >
          <div className="flex flex-col gap-4 text-start">
            <p className="text-sm leading-7 text-warm-600">
              {t("settings.restorePrefix")}
              {restore.phase === "confirming" ? restore.file.name : ""}{t("settings.restoreSuffix")}
            </p>
            <div className="flex items-center justify-start gap-3">
              <Button variant="danger" onClick={() => void onRestoreConfirmed()}>
                {t("settings.restoreYes")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setRestore({ phase: "idle" })}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </Modal>

        {restore.phase === "restoring" && (
          <p
            role="status"
            className="rounded-field border border-primary-100 bg-primary-50 px-3 py-2.5 text-sm text-primary-700"
          >
            {t("settings.restoring")}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
