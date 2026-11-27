"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useState } from "react";
import {
  STAFF_ROLES,
  STAFF_ROLE_LABELS,
  type StaffRoleKey,
} from "@/lib/staff-view";
import type { StaffFormValues } from "@/lib/staff-view";
import { emptyStaffForm } from "@/lib/staff-view";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";

type Props = {
  open: boolean;
  /** null = إضافة عضو جديد، غير ذلك = تعديل العضو المحدد */
  editing: { id: string; values: StaffFormValues } | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

/**
 * نموذج إضافة/تعديل عضو الطاقم — نفس حقول المرجع: الاسم، الدور (أربعة
 * أدوار)، التخصص، الهاتف، نسبة العمولة، لون التمييز، وملاحظات الدوام.
 */
export function StaffFormModal({ open, editing, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [values, setValues] = useState<StaffFormValues>(
    editing?.values ?? emptyStaffForm(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof StaffFormValues) => (value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  async function save() {
    setError(null);
    if (values.name.trim().length < 2) {
      setError(t("patients.nameRequired"));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(
        editing ? `/api/staff/${encodeURIComponent(editing.id)}` : "/api/staff",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: values.name,
            role: values.role,
            specialty: values.specialty,
            phone: values.phone,
            commissionPercent: Number(values.commissionPercent) || 0,
            colorHex: values.colorHex,
            scheduleNote: values.scheduleNote,
          }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("staff.saveFailed"));
        return;
      }
      onSaved(editing ? t("staff.memberUpdated") : t("staff.memberAdded"));
    } catch {
      setError(t("errors.serverRetry"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t("staff.editMember") : t("staff.addNewMember")}
      className="max-w-xl"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("common.nameRequired")} htmlFor="staff-name">
          <Input
            id="staff-name"
            value={values.name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder={t("staff.drPlaceholder")}
            required
          />
        </Field>
        <Field label={t("staff.role")} htmlFor="staff-role">
          <Select
            id="staff-role"
            value={values.role}
            onChange={(e) => set("role")(e.target.value as StaffRoleKey)}
          >
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {STAFF_ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("staff.specialty")} htmlFor="staff-specialty">
          <Input
            id="staff-specialty"
            value={values.specialty}
            onChange={(e) => set("specialty")(e.target.value)}
            placeholder={t("dental.orthodontics")}
          />
        </Field>
        <Field label={t("common.phone")} htmlFor="staff-phone">
          <Input
            id="staff-phone"
            dir="ltr"
            value={values.phone}
            onChange={(e) => set("phone")(e.target.value)}
            inputMode="tel"
          />
        </Field>
        <Field label={t("staff.commissionPercent")} htmlFor="staff-commission">
          <Input
            id="staff-commission"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={values.commissionPercent}
            onChange={(e) => set("commissionPercent")(e.target.value)}
            className="numeric"
          />
        </Field>
        <Field label={t("staff.accentColor")} htmlFor="staff-color">
          <Input
            id="staff-color"
            type="color"
            value={values.colorHex}
            onChange={(e) => set("colorHex")(e.target.value)}
            className="h-10 p-1"
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("staff.scheduleNote")} htmlFor="staff-schedule">
            <Input
              id="staff-schedule"
              value={values.scheduleNote}
              onChange={(e) => set("scheduleNote")(e.target.value)}
              placeholder={t("staff.scheduleExample")}
            />
          </Field>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-danger-600">
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <Button onClick={save} loading={busy} disabled={busy}>
          {t("common.save")}
        </Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {t("common.cancel")}
        </Button>
      </div>
    </Modal>
  );
}
