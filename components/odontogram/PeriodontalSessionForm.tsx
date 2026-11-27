"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useState } from "react";
import type { PeriodontalReadingDto } from "@/lib/services/periodontal";
import {
  MOBILITY_MAX_GRADE,
  MOBILITY_MIN_GRADE,
  POCKET_DEPTH_MAX_MM,
  POCKET_DEPTH_MIN_MM,
  RECESSION_MAX_MM,
  RECESSION_MIN_MM,
  latestReadingByTooth,
} from "@/lib/odontogram/periodontal-view";
import { lowerRowLeftToRight, upperRowLeftToRight, toothName } from "@/lib/odontogram/fdi";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

// مدخل قياس دواعم جماعي — موضع واحد لكل سن في جلسة واحدة. كل القياسات
// المُدخلة تُحفظ بضغطة «حفظ الجلسة» عبر مسار الجلسة فتُلحق بتوقيت قياس واحد.
// الحقول الرقمية بحدود صريحة كنموذج السن الواحد، والقيم السابقة تظهر تلقائياً
// كتلميح لا كقيمة — الجلسة الجديدة تبدأ فارغة وقياسها الجديد هو الملزِم.

type Props = {
  patientId: string;
  /** كل قراءات المريض — لعرض آخر قيمة لكل سن كتلميح */
  readings: PeriodontalReadingDto[];
  onSessionSaved: (readings: PeriodontalReadingDto[]) => void;
  onDone: () => void;
  saveVariant?: "primary" | "gold";
};

type ToothEntry = {
  pocket: string;
  recession: string;
  mobility: string;
  bleeding: boolean;
};

function emptyEntry(): ToothEntry {
  return { pocket: "", recession: "", mobility: "", bleeding: false };
}

function parseField(
  raw: string,
  min: number,
  max: number,
): number | undefined | null {
  // null يعني قيمة خارج الحدود — undefined يعني فارغاً (لم يُقَس).
  if (raw.trim() === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) return null;
  return value;
}

export default function PeriodontalSessionForm({
  patientId,
  readings,
  onSessionSaved,
  onDone,
  saveVariant = "primary",
}: Props) {
  const { t, locale } = useI18n();
  const upper = upperRowLeftToRight();
  const lower = lowerRowLeftToRight();
  const allFdi = [...upper, ...lower].map((cell) => cell.fdi);

  const previous = latestReadingByTooth(readings);
  const [entries, setEntries] = useState<Record<number, ToothEntry>>(() =>
    Object.fromEntries(allFdi.map((fdi) => [fdi, emptyEntry()])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(fdi: number, patch: Partial<ToothEntry>) {
    setEntries((prev) => ({ ...prev, [fdi]: { ...prev[fdi], ...patch } }));
  }

  const filledFdi = allFdi.filter((fdi) => {
    const e = entries[fdi];
    return (
      e &&
      (e.bleeding ||
        e.pocket.trim() !== "" ||
        e.recession.trim() !== "" ||
        e.mobility.trim() !== "")
    );
  });

  async function saveSession() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/patients/${encodeURIComponent(patientId)}/periodontal/session`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            readings: filledFdi.map((fdi) => {
              const e = entries[fdi];
              return {
                toothFdi: fdi,
                pocketDepthMm: parseField(
                  e.pocket,
                  POCKET_DEPTH_MIN_MM,
                  POCKET_DEPTH_MAX_MM,
                ),
                recessionMm: parseField(
                  e.recession,
                  RECESSION_MIN_MM,
                  RECESSION_MAX_MM,
                ),
                mobilityGrade: parseField(
                  e.mobility,
                  MOBILITY_MIN_GRADE,
                  MOBILITY_MAX_GRADE,
                ),
                bleedingOnProbing: e.bleeding ? true : undefined,
              };
            }),
          }),
        },
      );
      const data = (await res.json()) as {
        readings?: PeriodontalReadingDto[];
        error?: string;
      };
      if (!res.ok || !data.readings) {
        setError(data.error ?? t("periodontal.saveSessionFailed"));
        return;
      }
      onSessionSaved(data.readings as PeriodontalReadingDto[]);
      onDone();
    } catch {
      setError(t("errors.server"));
    } finally {
      setSaving(false);
    }
  }

  function renderRow(cells: { fdi: number }[]) {
    return (
      <div dir="ltr" className="overflow-x-auto">
        <div className="flex w-max gap-2">
          {cells.map(({ fdi }) => {
            const entry = entries[fdi];
            const prev = previous.get(fdi);
            return (
              <div
                key={fdi}
                className="border-warm-200 bg-surface rounded-field w-28 shrink-0 border p-2"
              >
                <p className="text-ink-900 numeric text-center text-xs font-bold">
                  {fdi}
                </p>
                {prev && (
                  <p className="text-warm-400 numeric text-center text-[10px]">
                    {t("periodontal.lastReading")}{" "}
                    {[
                      prev.pocketDepthMm !== null
                        ? `${prev.pocketDepthMm}مم`
                        : null,
                      prev.mobilityGrade !== null
                        ? `ح${prev.mobilityGrade}`
                        : null,
                      prev.bleedingOnProbing ? t("periodontal.bleeding") : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                )}
                <label className="text-warm-500 mt-1 block text-[10px]">
                  {t("periodontal.depthMm")}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={POCKET_DEPTH_MIN_MM}
                    max={POCKET_DEPTH_MAX_MM}
                    step={1}
                    value={entry?.pocket ?? ""}
                    onChange={(e) => update(fdi, { pocket: e.target.value })}
                    aria-label={t("periodontal.pocketAria", { fdi, name: toothName(locale, fdi) ?? "" })}
                    className="numeric border-warm-300 bg-surface-raised focus:border-primary-500 focus:outline-primary-500 rounded-field text-ink-900 w-full border px-1.5 py-1 text-xs focus:outline-2 focus:outline-offset-0"
                  />
                </label>
                <label className="text-warm-500 mt-1 block text-[10px]">
                  {t("periodontal.recessionMmShort")}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={RECESSION_MIN_MM}
                    max={RECESSION_MAX_MM}
                    step={1}
                    value={entry?.recession ?? ""}
                    onChange={(e) => update(fdi, { recession: e.target.value })}
                    aria-label={`الانكماش اللثوي للسن ${fdi}`}
                    className="numeric border-warm-300 bg-surface-raised focus:border-primary-500 focus:outline-primary-500 rounded-field text-ink-900 w-full border px-1.5 py-1 text-xs focus:outline-2 focus:outline-offset-0"
                  />
                </label>
                <label className="text-warm-500 mt-1 block text-[10px]">
                  {t("periodontal.mobilityShort")}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={MOBILITY_MIN_GRADE}
                    max={MOBILITY_MAX_GRADE}
                    step={1}
                    value={entry?.mobility ?? ""}
                    onChange={(e) => update(fdi, { mobility: e.target.value })}
                    aria-label={`درجة الحركية للسن ${fdi}`}
                    className="numeric border-warm-300 bg-surface-raised focus:border-primary-500 focus:outline-primary-500 rounded-field text-ink-900 w-full border px-1.5 py-1 text-xs focus:outline-2 focus:outline-offset-0"
                  />
                </label>
                <button
                  type="button"
                  aria-pressed={entry?.bleeding ?? false}
                  onClick={() => update(fdi, { bleeding: !entry?.bleeding })}
                  className={cn(
                    "rounded-field mt-1 w-full border px-1 py-1 text-[10px] font-medium transition-colors",
                    "focus-visible:outline-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2",
                    entry?.bleeding
                      ? "border-danger-500 bg-danger-500 text-white"
                      : "border-warm-300 bg-surface-raised text-warm-600 hover:bg-surface-hover",
                  )}
                >
                  {entry?.bleeding ? t("periodontal.bleeding") : t("periodontal.noBleeding")}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-warm-500 text-xs">
        {t("periodontal.sessionFullHint")}
      </p>

      {renderRow(upper)}
      <div className="border-warm-300 border-t border-dashed" aria-hidden />
      {renderRow(lower)}

      {error && (
        <p
          role="alert"
          className="border-danger-300 bg-danger-50 text-danger-700 rounded-field border px-3 py-2 text-xs"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant={saveVariant}
          onClick={saveSession}
          loading={saving}
          disabled={filledFdi.length === 0 || saving}
          className="w-full sm:w-auto"
        >
          {saving
            ? t("common.saving")
            : `حفظ الجلسة (${filledFdi.length} ${filledFdi.length === 1 ? t("common.toothUnit") : t("dental.teeth")})`}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
