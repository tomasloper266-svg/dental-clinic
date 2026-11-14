"use client";

import { useEffect, useState } from "react";
import type { PlanItemDto } from "@/lib/services/treatment-plan";
import { planStatusMeta } from "@/lib/treatment-plan-view";
import type { StaffMemberDto } from "@/lib/services/staff";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

// إنشاء خطة جديدة — تُربط بالبنود غير المخططة المختارة (itemIds) عبر مسار
// الخدمة القائم؛ الخطة بلا بنود تُقبل أيضاً فتظهر جاهزة لإضافة العناصر.

type Props = {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  /** بنود بلا خطة محفوظة — المرشح للربط بالخطة الجديدة */
  unassignedItems: PlanItemDto[];
  doctors: StaffMemberDto[];
  onCreated: () => void;
};

export default function NewPlanModal({
  open,
  onClose,
  patientId,
  patientName,
  unassignedItems,
  doctors,
  onCreated,
}: Props) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setDoctorName("");
      setNotes("");
      setError(null);
      setDate(new Date().toISOString().slice(0, 10));
      setSelected(new Set());
    }
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function create() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/patients/${encodeURIComponent(patientId)}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || null,
          doctorName: doctorName || null,
          planDate: date ? new Date(date).toISOString() : null,
          notes: notes.trim() || null,
          itemIds: [...selected],
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "تعذر إنشاء الخطة، حاول مرة أخرى");
        return;
      }
      toast("أُنشئت الخطة بنجاح");
      onCreated();
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="خطة جديدة"
      titleClassName="text-warning-500 text-base font-bold"
      className="max-w-2xl"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="المريض *" htmlFor="plan-patient">
          <Input id="plan-patient" value={patientName} readOnly />
        </Field>
        <Field label="الطبيب" htmlFor="plan-doctor">
          <select
            id="plan-doctor"
            value={doctorName}
            onChange={(event) => setDoctorName(event.target.value)}
            className="focus-ring w-full rounded-field border border-warm-300 bg-surface px-3 py-2 text-sm text-ink-900"
          >
            <option value="">—</option>
            {doctors.map((doctor) => (
              <option key={doctor.id} value={doctor.name}>
                {doctor.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="اسم الخطة" htmlFor="plan-name" hint="اختياري — يُشتق تلقائياً إن تُرك فارغاً">
          <Input
            id="plan-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="خطة العلاج والتنظيف"
          />
        </Field>
        <Field label="التاريخ" htmlFor="plan-date">
          <Input
            id="plan-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </Field>
      </div>

      <p className="text-steel-500 mt-3 text-xs">
        بنود بلا خطة محفوظة حالياً — اختر ما سيُربط بهذه الخطة (الباقي يبقى متاحاً)
      </p>

      <ul className="border-warm-200 mt-2 divide-y divide-warm-100 rounded-field border">
        {unassignedItems.length === 0 && (
          <li className="text-steel-500 px-3 py-3 text-sm">
            لا بنود بلا خطة — أضف بنوداً من جدول العمليات أولاً.
          </li>
        )}
        {unassignedItems.map((item) => {
          const meta = planStatusMeta(item.status);
          return (
            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggle(item.id)}
                  className="accent-warning-500 h-4 w-4"
                />
                <span className="text-ink-900">{item.procedure}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.toneClass}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {meta.labelAr}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="mt-3">
        <Field label="ملاحظات" htmlFor="plan-notes">
          <textarea
            id="plan-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="focus-ring w-full rounded-field border border-warm-300 bg-surface px-3 py-2 text-sm text-ink-900"
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {error}
        </p>
      )}

      <footer className="mt-4 flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          إغلاق
        </Button>
        <Button variant="gold" onClick={create} loading={saving}>
          إضافة الخطة
        </Button>
      </footer>
    </Modal>
  );
}
