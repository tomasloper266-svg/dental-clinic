"use client";

import { useState } from "react";
import type { PeriodontalReadingDto } from "@/lib/services/periodontal";
import {
  MOBILITY_MAX_GRADE,
  MOBILITY_MIN_GRADE,
  POCKET_DEPTH_MAX_MM,
  POCKET_DEPTH_MIN_MM,
  RECESSION_MAX_MM,
  RECESSION_MIN_MM,
  readingsForTooth,
} from "@/lib/odontogram/periodontal-view";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { cn } from "@/components/ui/cn";

// نموذج قياس دواعم لسن واحد — أول حقول عددية سريرية في النظام، بحدود صريحة
// معلَنة على كل حقل (عمق 0–15مم، انكماش −5..10مم، حركية 0–3). القراءة الجزئية
// مقبولة — الاستكشاف السريري قد يقيّد بعض القياسات فقط — والفارغة كلياً تُرفض.
// السجل إلحاقي: كل حفظ يضيف قياساً جديداً بتاريخه ولا يستبدل السابق.

type Props = {
  patientId: string;
  fdi: number;
  /** كل قراءات المريض — يُستخرج سجل هذا السن منها بـ readingsForTooth */
  readings: PeriodontalReadingDto[];
  onSaved: (reading: PeriodontalReadingDto) => void;
  saveVariant?: "primary" | "gold";
};

function formatDateAr(iso: string): string {
  return new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function PeriodontalReadingForm({
  patientId,
  fdi,
  readings,
  onSaved,
  saveVariant = "primary",
}: Props) {
  const [pocket, setPocket] = useState("");
  const [recession, setRecession] = useState("");
  const [mobility, setMobility] = useState("");
  const [bleeding, setBleeding] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toothHistory = readingsForTooth(readings, fdi);

  // قيمة رقمية ضمن الحدود أو فارغة — أي شيء آخر يمنع الحفظ بدل تخمينه.
  function parseField(
    raw: string,
    min: number,
    max: number,
  ): { ok: true; value: number | undefined } | { ok: false; label: string } {
    if (raw.trim() === "") return { ok: true, value: undefined };
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) {
      return { ok: false, label: `${min}–${max}` };
    }
    return { ok: true, value };
  }

  const pocketParsed = parseField(
    pocket,
    POCKET_DEPTH_MIN_MM,
    POCKET_DEPTH_MAX_MM,
  );
  const recessionParsed = parseField(
    recession,
    RECESSION_MIN_MM,
    RECESSION_MAX_MM,
  );
  const mobilityParsed = parseField(
    mobility,
    MOBILITY_MIN_GRADE,
    MOBILITY_MAX_GRADE,
  );

  const hasAnyMeasurement =
    bleeding ||
    (pocketParsed.ok && pocketParsed.value !== undefined) ||
    (recessionParsed.ok && recessionParsed.value !== undefined) ||
    (mobilityParsed.ok && mobilityParsed.value !== undefined) ||
    note.trim().length > 0;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/patients/${encodeURIComponent(patientId)}/periodontal`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            toothFdi: fdi,
            pocketDepthMm:
              pocketParsed.ok && pocketParsed.value !== undefined
                ? pocketParsed.value
                : undefined,
            recessionMm:
              recessionParsed.ok && recessionParsed.value !== undefined
                ? recessionParsed.value
                : undefined,
            mobilityGrade:
              mobilityParsed.ok && mobilityParsed.value !== undefined
                ? mobilityParsed.value
                : undefined,
            bleedingOnProbing: bleeding ? true : undefined,
            note: note.trim() || undefined,
          }),
        },
      );
      const data = (await res.json()) as {
        reading?: PeriodontalReadingDto;
        error?: string;
      };
      if (!res.ok || !data.reading) {
        setError(data.error ?? "تعذر تسجيل القياس");
        return;
      }
      onSaved(data.reading as PeriodontalReadingDto);
      // الإلحاق الناجح يبدأ قياساً جديداً فارغاً — السجل يبقى ظاهراً أسفله.
      setPocket("");
      setRecession("");
      setMobility("");
      setBleeding(false);
      setNote("");
    } catch {
      setError("تعذر الاتصال بالخادم");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-warm-500 text-xs">
        قياسات عددية بالمليمتر — اترك الحقل فارغاً إن لم يُقَس. القياسات الإلحاقية:
        كل حفظ يضيف قياساً جديداً بتاريخه.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={`عمق الجيب (مم)`}
          htmlFor={`perio-pocket-${fdi}`}
          hint={`${POCKET_DEPTH_MIN_MM}–${POCKET_DEPTH_MAX_MM}`}
        >
          <Input
            id={`perio-pocket-${fdi}`}
            type="number"
            inputMode="numeric"
            min={POCKET_DEPTH_MIN_MM}
            max={POCKET_DEPTH_MAX_MM}
            step={1}
            value={pocket}
            onChange={(e) => setPocket(e.target.value)}
            placeholder="مثال: 4"
            className="numeric"
          />
        </Field>
        <Field
          label="الانكماش اللثوي (مم)"
          htmlFor={`perio-recession-${fdi}`}
          hint={`${RECESSION_MIN_MM}–${RECESSION_MAX_MM} — سالب فوق الخط`}
        >
          <Input
            id={`perio-recession-${fdi}`}
            type="number"
            inputMode="numeric"
            min={RECESSION_MIN_MM}
            max={RECESSION_MAX_MM}
            step={1}
            value={recession}
            onChange={(e) => setRecession(e.target.value)}
            placeholder="مثال: -2"
            className="numeric"
          />
        </Field>
        <Field
          label="الحركية (درجة)"
          htmlFor={`perio-mobility-${fdi}`}
          hint={`${MOBILITY_MIN_GRADE}–${MOBILITY_MAX_GRADE}`}
        >
          <Input
            id={`perio-mobility-${fdi}`}
            type="number"
            inputMode="numeric"
            min={MOBILITY_MIN_GRADE}
            max={MOBILITY_MAX_GRADE}
            step={1}
            value={mobility}
            onChange={(e) => setMobility(e.target.value)}
            placeholder="مثال: 1"
            className="numeric"
          />
        </Field>
        <div className="flex flex-col justify-end gap-1.5">
          <span className="text-ink-900 text-sm font-medium">
            نزيف عند الجس
          </span>
          <button
            type="button"
            aria-pressed={bleeding}
            onClick={() => setBleeding((prev) => !prev)}
            className={cn(
              "rounded-field border px-3 py-2 text-xs font-medium transition-colors",
              "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
              bleeding
                ? "border-danger-500 bg-danger-500 text-white"
                : "border-warm-300 bg-surface-raised text-warm-600 hover:bg-surface-hover active:bg-surface-sunken",
            )}
          >
            {bleeding ? "نزيف موجود" : "بلا نزيف"}
          </button>
        </div>
      </div>

      <Field label="ملاحظة (اختياري)" htmlFor={`perio-note-${fdi}`}>
        <Input
          id={`perio-note-${fdi}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="مثال: جيب حيوي عند القريبة"
        />
      </Field>

      {(pocketParsed.ok === false ||
        recessionParsed.ok === false ||
        mobilityParsed.ok === false) && (
        <p
          role="alert"
          className="border-danger-300 bg-danger-50 text-danger-700 rounded-field border px-3 py-2 text-xs"
        >
          قيمة خارج الحدود المسموحة — صحّح الحقل المحدَّد قبل الحفظ.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="border-danger-300 bg-danger-50 text-danger-700 rounded-field border px-3 py-2 text-xs"
        >
          {error}
        </p>
      )}

      <div>
        <Button
          variant={saveVariant}
          onClick={save}
          loading={saving}
          disabled={!hasAnyMeasurement || saving}
          className="w-full sm:w-auto"
        >
          {saving ? "جارٍ الحفظ…" : "تسجيل القياس"}
        </Button>
      </div>

      {toothHistory.length > 0 && (
        <div className="border-warm-200 border-t pt-4">
          <p className="text-warm-600 mb-2 text-xs font-semibold">
            سجل قياسات هذا السن (
            <span className="numeric">{toothHistory.length}</span>)
          </p>
          <ul className="space-y-1.5">
            {toothHistory
              .slice()
              .reverse()
              .map((r) => (
                <li
                  key={r.id}
                  className="bg-surface text-warm-700 rounded-field flex flex-wrap items-center gap-2 px-3 py-2 text-xs"
                >
                  <span className="numeric">
                    {r.pocketDepthMm === null
                      ? "—"
                      : `عمق ${r.pocketDepthMm}مم`}
                  </span>
                  {r.recessionMm !== null && (
                    <span className="numeric">انكماش {r.recessionMm}مم</span>
                  )}
                  {r.mobilityGrade !== null && (
                    <span className="numeric">حركية {r.mobilityGrade}</span>
                  )}
                  {r.bleedingOnProbing && (
                    <span className="text-danger-600 font-semibold">نزيف</span>
                  )}
                  <span className="text-warm-400 numeric">
                    {formatDateAr(r.measuredAt)}
                  </span>
                  {r.note && <span className="w-full">{r.note}</span>}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
