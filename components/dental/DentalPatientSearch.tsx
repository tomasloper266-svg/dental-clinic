"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { PatientDto } from "@/lib/services/patients";
import { saveLastPatientId } from "@/lib/patients/last-patient";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

// بطاقة اختيار المريض في مخطط الأسنان المستقل — بحث فوري بقائمة مرضى حقيقيين،
// وزر «فتح الملف الكامل» ينقل إلى نفس ملف المريض الذي يفتحه زر «الملف»
// في قائمة المرضى (/patients/[patientId]) — لا مسار ثانٍ ولا نسخة موازية.

const SEARCH_DEBOUNCE_MS = 300;

type Props = {
  /** المريض المختار من العنوان (?patient=) */
  selectedPatientId?: string;
  /** يحفظ الذاكرة نفسها التي يعتمدها منتقي /chart — استمرارية بين الصفحتين */
  className?: string;
};

export default function DentalPatientSearch({
  selectedPatientId,
  className,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<PatientDto[] | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (search: string) => {
    setError(null);
    try {
      const res = await fetch(
        `/api/patients${search ? `?q=${encodeURIComponent(search)}` : ""}`,
      );
      if (!res.ok) {
        setError("تعذر تحميل قائمة المرضى، حاول مرة أخرى");
        return;
      }
      const data = (await res.json()) as { patients: PatientDto[] };
      setPatients(data.patients);
    } catch {
      setError("تعذر الاتصال بالخادم");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => void load(query.trim()),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [query, load]);

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const selected = patients?.find((p) => p.id === selectedPatientId) ?? null;

  function openFullFile() {
    if (!selectedPatientId) return;
    saveLastPatientId(window.localStorage, selectedPatientId);
    router.push(`/patients/${encodeURIComponent(selectedPatientId)}`);
  }

  return (
    <section
      aria-label="اختيار المريض"
      className={cn(
        "rounded-panel border border-warm-200 bg-surface-raised px-4 py-3 shadow-xs",
        className,
      )}
    >
      <p className="text-steel-600 text-xs">اختر المريض لعرض مخطط أسنانه وخطة علاجه</p>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="gold"
          onClick={openFullFile}
          disabled={!selectedPatientId}
          title={selectedPatientId ? undefined : "اختر مريضاً أولاً"}
        >
          فتح الملف الكامل
        </Button>

        {/* منتقي المريض — قائمة حقيقية من قاعدة البيانات */}
        <div ref={containerRef} className="relative min-w-56">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
            className="focus-ring flex w-full items-center justify-between gap-2 rounded-field border border-warm-300 bg-surface px-3 py-2 text-sm text-ink-900"
          >
            <span className={cn(!selected && "text-steel-400")}>
              {selected ? selected.name : "اختر المريض…"}
            </span>
            <Search size={14} className="text-steel-400" aria-hidden />
          </button>

          {open && (
            <div className="absolute z-30 mt-1 w-full rounded-field border border-warm-200 bg-surface-raised shadow-md">
              <div className="flex items-center gap-2 border-b border-warm-200 px-3 py-2">
                <Search size={14} className="text-steel-500" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ابحث بالاسم أو رقم الملف أو أي شيء"
                  aria-label="بحث في المرضى"
                  className="focus-ring w-full bg-transparent py-1 text-sm text-ink-900 outline-none placeholder:text-steel-400"
                />
              </div>

              {error && (
                <p role="alert" className="px-3 py-2 text-sm text-danger-700">
                  {error}
                </p>
              )}

              {patients === null && !error && (
                <p className="px-3 py-2 text-sm text-steel-500">
                  جارٍ تحميل المرضى…
                </p>
              )}

              {patients !== null && patients.length === 0 && (
                <p className="px-3 py-2 text-sm text-steel-500">
                  لا مرضى مطابقين للبحث.
                </p>
              )}

              {patients !== null && patients.length > 0 && (
                <ul
                  role="listbox"
                  aria-label="قائمة المرضى"
                  className="max-h-72 divide-y divide-warm-100 overflow-y-auto"
                >
                  {patients.map((patient) => {
                    const active = patient.id === selectedPatientId;
                    return (
                      <li key={patient.id} role="option" aria-selected={active}>
                        <button
                          type="button"
                          onClick={() => {
                            saveLastPatientId(window.localStorage, patient.id);
                            setOpen(false);
                            setQuery("");
                            router.replace(
                              `/dental?patient=${encodeURIComponent(patient.id)}`,
                            );
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm transition-colors hover:bg-surface-hover",
                            active
                              ? "bg-primary-50 font-semibold text-primary-800"
                              : "text-ink-900",
                          )}
                        >
                          <span className="truncate">{patient.name}</span>
                          <span className="numeric text-xs text-steel-500">
                            {patient.phone ?? "—"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
