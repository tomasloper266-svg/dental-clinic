"use client";

import { useCallback, useEffect, useState } from "react";
import { PatientOption } from "@/components/BookingForm";
import { formatTime } from "@/lib/appointment-ui";
import type { WaitlistStatus } from "@/lib/services/waitlist";

// لوحة قائمة الانتظار ومقترحات الفجوات — إضافة مريض طالب موعداً،
// وحجز أي قيد في فجوة شاغرة بضغطة واحدة.

type WaitlistEntryJson = {
  id: string;
  patientId: string;
  patientName: string;
  preferredWindow: string;
  priority: number;
  status: WaitlistStatus;
  note: string | null;
};

type GapJson = {
  start: string;
  end: string;
  durationMin: number;
};

export default function WaitlistBoard({
  initialDate,
}: {
  initialDate: string;
}) {
  const [entries, setEntries] = useState<WaitlistEntryJson[] | null>(null);
  const [gapsDate, setGapsDate] = useState(initialDate);
  const [gaps, setGaps] = useState<GapJson[] | null>(null);
  const [gapsError, setGapsError] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/waitlist");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { entries: WaitlistEntryJson[] };
      setEntries(data.entries);
    } catch {
      setEntries([]);
      setMessage("تعذر تحميل قائمة الانتظار، أعد المحاولة");
    }
  }, []);

  const refreshGaps = useCallback(async (date: string) => {
    setGapsError(false);
    try {
      const res = await fetch(`/api/waitlist/gaps?date=${date}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { gaps: GapJson[] };
      setGaps(data.gaps);
    } catch {
      setGaps(null);
      setGapsError(true);
    }
  }, []);

  useEffect(() => {
    refreshEntries();
  }, [refreshEntries]);

  useEffect(() => {
    refreshGaps(gapsDate);
  }, [gapsDate, refreshGaps]);

  async function bookIntoGap(entryId: string, gap: GapJson) {
    setBookingId(entryId);
    setMessage(null);
    try {
      const res = await fetch("/api/waitlist/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          waitlistEntryId: entryId,
          startsAt: gap.start,
          durationMin: Math.min(gap.durationMin, 30),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage(data.error ?? "تعذر الحجز");
        return;
      }
      setMessage("تم الحجز في الفجوة");
      await Promise.all([refreshEntries(), refreshGaps(gapsDate)]);
    } catch {
      setMessage("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setBookingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {message && (
        <p
          role="status"
          className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-800"
        >
          {message}
        </p>
      )}

      <AddWaitlistEntryForm onAdded={refreshEntries} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-teal-800">
          المرضى في قائمة الانتظار
        </h2>
        {entries === null && (
          <div className="h-16 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
        )}
        {entries !== null && entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-center text-sm text-gray-500">
            لا أحد في الانتظار — أضف مريضاً طالب موعداً من النموذج أعلاه.
          </div>
        )}
        {entries?.map((e) => (
          <article
            key={e.id}
            className="rounded-xl border border-gray-200 bg-white p-3 text-sm shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">{e.patientName}</p>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-800">
                {e.status === "WAITING" ? "انتظار" : "مُقدَّم له فجوة"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-gray-600">
              الفترة المفضلة: {e.preferredWindow}
              {e.priority > 0 ? ` · أولوية ${e.priority}` : ""}
            </p>
            {e.note && <p className="mt-1 text-xs text-gray-500">{e.note}</p>}
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-teal-800">
            فجوات شاغرة مقترحة
          </h2>
          <input
            type="date"
            value={gapsDate}
            onChange={(e) => setGapsDate(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1 text-xs"
          />
        </div>
        {gapsError && (
          <p role="alert" className="text-xs text-red-700">
            تعذر تحميل الفجوات، أعد المحاولة
          </p>
        )}
        {gaps !== null && gaps.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5 text-center text-sm text-gray-500">
            لا فجوات شاغرة في ساعات عمل هذا اليوم.
          </div>
        )}
        {gaps?.map((gap) => (
          <div
            key={gap.start}
            className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm"
          >
            <p>
              {formatTime(gap.start)} → {formatTime(gap.end)} ·{" "}
              {gap.durationMin} دقيقة
            </p>
            <div className="flex items-center gap-1">
              {entries
                ?.filter((e) => e.status === "WAITING")
                .slice(0, 2)
                .map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    disabled={bookingId !== null}
                    onClick={() => bookIntoGap(e.id, gap)}
                    className="rounded-full bg-teal-700 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    {bookingId === e.id ? "…" : `حجز ${e.patientName}`}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function AddWaitlistEntryForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<PatientOption[]>([]);
  const [selected, setSelected] = useState<PatientOption | null>(null);
  const [window_, setWindow] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/patients?q=${encodeURIComponent(search.trim())}`,
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { patients: PatientOption[] };
        setOptions(data.patients);
      } catch {
        setOptions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function submit() {
    if (!selected) {
      setError("اختر مريضاً أولاً");
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
          preferredWindow: window_,
          note: note.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "تعذر الإضافة");
        return;
      }
      setSelected(null);
      setSearch("");
      setWindow("");
      setNote("");
      onAdded();
    } catch {
      setError("تعذر الاتصال بالخادم، حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-teal-700 px-4 py-3 text-sm font-semibold text-teal-800"
      >
        + إضافة مريض لقائمة الانتظار
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-teal-800">
        إضافة لقائمة الانتظار
      </h3>
      {selected ? (
        <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {selected.name}
        </p>
      ) : (
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن المريض…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      )}
      {!selected && options.length > 0 && (
        <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-200">
          {options.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(p);
                  setOptions([]);
                }}
                className="w-full bg-white px-3 py-2 text-right text-sm hover:bg-teal-50"
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        type="text"
        value={window_}
        onChange={(e) => setWindow(e.target.value)}
        placeholder="الفترة المفضلة: مثلاً صباح الثلاثاء"
        className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ملاحظة (اختياري)"
        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="flex-1 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "جارٍ الإضافة…" : "إضافة"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-600"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
