"use client";

import { useCallback, useEffect, useState } from "react";
import BookingForm from "@/components/BookingForm";
import { formatDayLabel, formatTime, STATUS_META } from "@/lib/appointment-ui";
import { addDays, toDateInputValue } from "@/lib/dates";
import type { AppointmentStatus } from "@/lib/services/appointments";

// لوحة الجدول اليومي/الأسبوعي — موبايل-أولاً، تنقّل بين الأيام والأسابيع،
// وحالات ملونة مع تسمية نصية صريحة.

type AppointmentJson = {
  id: string;
  patientId: string;
  patientName: string;
  startsAt: string;
  durationMin: number;
  status: AppointmentStatus;
  reason: string | null;
  note: string | null;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; appointments: AppointmentJson[] };

export default function AppointmentsBoard({
  initialDate,
}: {
  initialDate: string;
}) {
  const [dateValue, setDateValue] = useState(initialDate);
  const [view, setView] = useState<"day" | "week">("day");
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const refresh = useCallback(
    async (date: string, currentView: "day" | "week") => {
      setState({ kind: "loading" });
      try {
        const res = await fetch(
          `/api/appointments?date=${date}&view=${currentView}`,
        );
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { appointments: AppointmentJson[] };
        setState({ kind: "loaded", appointments: data.appointments });
      } catch {
        setState({ kind: "error" });
      }
    },
    [],
  );

  useEffect(() => {
    refresh(dateValue, view);
  }, [dateValue, view, refresh]);

  const step = view === "week" ? 7 : 1;
  const move = (days: number) =>
    setDateValue((d) =>
      toDateInputValue(addDays(new Date(`${d}T00:00:00`), days)),
    );

  const rangeLabel =
    view === "day"
      ? formatDayLabel(new Date(`${dateValue}T00:00:00`))
      : `أسبوع ${formatDayLabel(new Date(`${dateValue}T00:00:00`))}`;

  return (
    <div className="flex flex-col gap-4">
      {/* التنقل بين الأيام والأسابيع */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => move(-step)}
          aria-label="السابق"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          ←
        </button>
        <div className="flex flex-1 flex-col items-center">
          <span className="text-sm font-bold text-gray-800">{rangeLabel}</span>
          <button
            type="button"
            onClick={() => setView(view === "day" ? "week" : "day")}
            className="text-xs text-teal-700 underline"
          >
            {view === "day" ? "عرض الأسبوع" : "عرض اليوم"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => move(step)}
          aria-label="التالي"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          →
        </button>
      </div>

      <BookingForm
        dateValue={dateValue}
        onBooked={() => refresh(dateValue, view)}
      />

      {state.kind === "loading" && <AppointmentsSkeleton />}

      {state.kind === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
          تعذر تحميل المواعيد
          <button
            type="button"
            onClick={() => refresh(dateValue, view)}
            className="ms-2 underline"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {state.kind === "loaded" &&
        (state.appointments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            لا مواعيد في هذه الفترة — استخدم زر الحجز لإضافة موعد.
          </div>
        ) : (
          <AppointmentsList view={view} appointments={state.appointments} />
        ))}
    </div>
  );
}

function AppointmentsSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl border border-gray-100 bg-gray-50"
        />
      ))}
    </div>
  );
}

function AppointmentsList({
  view,
  appointments,
}: {
  view: "day" | "week";
  appointments: AppointmentJson[];
}) {
  const byDay = new Map<string, AppointmentJson[]>();
  for (const a of appointments) {
    const day = a.startsAt.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), a]);
  }

  if (view === "week") {
    return (
      <div className="flex flex-col gap-4">
        {[...byDay.entries()].map(([day, items]) => (
          <section key={day} className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-gray-500">
              {formatDayLabel(new Date(`${day}T00:00:00`))}
            </h3>
            {items.map((a) => (
              <AppointmentCard key={a.id} appointment={a} />
            ))}
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {appointments.map((a) => (
        <AppointmentCard key={a.id} appointment={a} />
      ))}
    </div>
  );
}

function AppointmentCard({ appointment: a }: { appointment: AppointmentJson }) {
  const meta = STATUS_META[a.status];
  return (
    <article
      className={`rounded-xl border p-3 shadow-sm ${meta.chip}`}
      data-testid="appointment-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold">{a.patientName}</p>
          <p className="mt-0.5 text-xs">
            {formatTime(a.startsAt)} · {a.durationMin} دقيقة ·{" "}
            {a.reason || "بدون سبب محدد"}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">
          {meta.label}
        </span>
      </div>
      {a.note && <p className="mt-2 text-xs opacity-80">{a.note}</p>}
    </article>
  );
}
