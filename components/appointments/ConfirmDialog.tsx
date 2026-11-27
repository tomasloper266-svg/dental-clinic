"use client";

import { Button } from "@/components/ui/Button";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Modal } from "@/components/ui/Modal";

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
};

/** تأكيد عملية حساسة — زر خطير واحد وإلغاء، بلا إجراء قبل قرار صريح. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-md">
      {description && <p className="text-warm-600 text-sm">{description}</p>}
      <div className="mt-5 flex gap-2">
        <Button variant="danger" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          {t("common.back")}
        </Button>
      </div>
    </Modal>
  );
}
