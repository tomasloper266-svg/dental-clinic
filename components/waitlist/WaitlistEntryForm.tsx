"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useEffect, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { usePatientSearch, type PatientOption } from "@/lib/use-patient-search";

// إضافة مريض لقائمة الانتظار — نفس نموذج بحث المرضى الموحّد في نموذج
// الحجز، والخطأ مضمّن تحت النموذج والحجز الناجح إشعار عابر.

type WaitlistEntryFormProps = {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
};

export default function WaitlistEntryForm({
  open,
  onClose,
  onAdded,
}: WaitlistEntryFormProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [selected, setSelected] = useState<PatientOption | null>(null);
  const [search, setSearch] = useState("");
  const options = usePatientSearch(search, open);
  const [preferredWindow, setPreferredWindow] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setSearch("");
      setPreferredWindow("");
      setNote("");
      setError(null);
    }
  }, [open]);

  async function submit() {
    if (!selected) {
      setError(t("patients.chooseFirst"));
      return;
    }
    if (preferredWindow.trim().length < 2) {
      setError(t("waitlist.windowPlaceholder"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientId: selected.id,
          preferredWindow: preferredWindow.trim(),
          note: note.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("common.addFailed"));
        return;
      }
      toast(t("waitlist.addedToast", { name: selected.name }));
      onAdded();
      onClose();
    } catch {
      setError(t("errors.serverRetry"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("waitlist.addToList")}>
      <div className="flex flex-col gap-4">
        <Field label={t("common.patient")} htmlFor="waitlist-patient">
          {selected ? (
            <div className="flex items-center justify-between rounded-field border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-800">
              <span>
                {selected.name}
                {selected.phone ? ` · ${selected.phone}` : ""}
              </span>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs font-medium text-primary-700 underline"
              >
                {t("common.change")}
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search
                size={16}
                aria-hidden
                className="absolute start-3 top-1/2 -translate-y-1/2 text-warm-400"
              />
              <Input
                id="waitlist-patient"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("patients.searchPhonePlaceholder")}
                className="ps-9"
              />
              {options.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-field border border-warm-200 bg-surface-raised shadow-md">
                  {options.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(p);
                          setSearch("");
                        }}
                        className="w-full px-3 py-2 text-start text-sm hover:bg-surface-hover"
                      >
                        {p.name}
                        {p.phone ? (
                          <span className="text-warm-500"> · {p.phone}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Field>

        <Field
          label={t("waitlist.preferredWindow")}
          htmlFor="waitlist-window"
          hint={t("waitlist.windowExample")}
        >
          <Input
            id="waitlist-window"
            type="text"
            value={preferredWindow}
            onChange={(e) => setPreferredWindow(e.target.value)}
            placeholder={t("waitlist.exampleTuesday")}
          />
        </Field>

        <Field label={t("common.noteOptional")} htmlFor="waitlist-note">
          <Textarea
            id="waitlist-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("appointments.detailsHint")}
          />
        </Field>

        {error && (
          <p
            role="alert"
            className="rounded-field border border-danger-300 bg-danger-50 px-3 py-2 text-xs text-danger-700"
          >
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button onClick={submit} loading={saving}>
            <UserPlus size={16} aria-hidden />
            {saving ? t("common.adding") : t("waitlist.addToWaitlist")}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
