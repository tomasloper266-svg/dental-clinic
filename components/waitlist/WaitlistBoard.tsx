"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  UserPlus,
} from "lucide-react";
import { addDays, toDateInputValue } from "@/lib/dates";
import { formatDayLabel, formatTime } from "@/lib/appointment-ui";
import {
  WAITLIST_STATUS_META,
  stripPercent,
  suggestEntriesForGap,
} from "@/lib/waitlist-view";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/Badge";
import { Table, THead, TRow, TH, TD } from "@/components/ui/Table";
import WaitlistEntryForm from "./WaitlistEntryForm";
import BookGapModal, {
  type GapJson,
  type WaitlistEntryJson,
} from "./BookGapModal";

// لوحة قائمة الانتظار: المرضى المنتظرون في جدول واحد، وشريط نهار الطبيب
// يُظهر الانشغال والفجوات الشاغرة، وكل فجوة تقترح مرضى الانتظار الأعلى
// أولوية للحجز فيها. الحجوزات عبر واجهة الخدمة نفسها بفحص التعارض.

type BusyBlock = { id: string; startsAt: string; durationMin: number };

type GapsState =
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "loaded";
      gaps: GapJson[];
      windowStart: string;
      windowEnd: string;
    };

export default function WaitlistBoard({ initialDate }: { initialDate: string }) {
  const [entries, setEntries] = useState<WaitlistEntryJson[] | null>(null);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [dateValue, setDateValue] = useState(initialDate);
  const [gapsState, setGapsState] = useState<GapsState>({ kind: "loading" });
  const [busy, setBusy] = useState<BusyBlock[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [bookingGap, setBookingGap] = useState<GapJson | null>(null);

  const refreshEntries = useCallback(async () => {
    setEntriesError(null);
    try {
      const res = await fetch("/api/waitlist");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { entries: WaitlistEntryJson[] };
      setEntries(data.entries);
    } catch {
      setEntriesError("تعذر تحميل قائمة الانتظار — تحقق من الاتصال ثم أعد المحاولة.");
    }
  }, []);

  const refreshGaps = useCallback(async (date: string) => {
    setGapsState({ kind: "loading" });
    setBusy(null);
    try {
      const [gapsRes, dayRes] = await Promise.all([
        fetch(`/api/waitlist/gaps?date=${date}`),
        fetch(`/api/appointments?date=${date}&view=day`),
      ]);
      if (!gapsRes.ok || !dayRes.ok) throw new Error();
      const gapsData = (await gapsRes.json()) as {
        gaps: GapJson[];
        windowStart: string;
        windowEnd: string;
      };
      const dayData = (await dayRes.json()) as {
        appointments: { id: string; startsAt: string; durationMin: number; status: string }[];
      };
      setGapsState({
        kind: "loaded",
        gaps: gapsData.gaps,
        windowStart: gapsData.windowStart,
        windowEnd: gapsData.windowEnd,
      });
      // كتل الشريط: كل موعد لم يُلغَ ولم يكتمل — نفس منطق حساب الفجوات.
      setBusy(
        dayData.appointments
          .filter((a) => a.status !== "CANCELLED" && a.status !== "COMPLETED")
          .map((a) => ({ id: a.id, startsAt: a.startsAt, durationMin: a.durationMin })),
      );
    } catch {
      setGapsState({ kind: "error" });
    }
  }, []);

  useEffect(() => {
    void refreshEntries();
  }, [refreshEntries]);

  useEffect(() => {
    void refreshGaps(dateValue);
  }, [dateValue, refreshGaps]);

  function afterChange() {
    void refreshEntries();
    void refreshGaps(dateValue);
  }

  const waiting = useMemo(
    () => (entries ? suggestEntriesForGap(entries) : []),
    [entries],
  );

  const windowMs =
    gapsState.kind === "loaded"
      ? Date.parse(gapsState.windowEnd) - Date.parse(gapsState.windowStart)
      : 0;

  return (
    <>
      <PageHeader
        title="قائمة الانتظار"
        description="مرضى طالبو موعداً، وفجوات شاغرة في جدول اليوم — الحجز في الفجوة يحجز للمنتظر الأعلى أولوية أولاً."
        actions={
          <Button onClick={() => setAdding(true)}>
            <UserPlus size={16} aria-hidden />
            إضافة مريض للانتظار
          </Button>
        }
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-5">
        {/* قائمة المرضى المنتظرين */}
        <section className="lg:col-span-2" aria-label="المرضى في قائمة الانتظار">
          <h2 className="text-sm font-semibold text-ink-900">
            المرضى المنتظرون
            {entries && entries.length > 0 && (
              <span className="numeric ms-2 text-xs text-warm-500">
                {entries.length}
              </span>
            )}
          </h2>

          {entriesError ? (
            <div
              role="alert"
              className="mt-3 flex flex-col items-start gap-2 rounded-panel border border-danger-300 bg-danger-50 px-4 py-4"
            >
              <p className="text-xs font-medium text-danger-700">{entriesError}</p>
              <Button variant="secondary" size="sm" onClick={() => void refreshEntries()}>
                إعادة المحاولة
              </Button>
            </div>
          ) : entries === null ? (
            <EntriesSkeleton />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={Hourglass}
              className="mt-3"
              title="لا أحد في الانتظار"
              description="أضف مريضاً طالب موعداً وسيظهر هنا مع فترته المفضلة وأولويته."
              action={
                <Button size="sm" onClick={() => setAdding(true)}>
                  <UserPlus size={14} aria-hidden />
                  إضافة مريض للانتظار
                </Button>
              }
            />
          ) : (
            <>
              {/* جدول الشاشات المتوسطة فأعلى */}
              <Table className="mt-3 hidden md:table">
                <THead>
                  <TRow>
                    <TH>المريض</TH>
                    <TH>الفترة المفضلة</TH>
                    <TH className="w-16">أولوية</TH>
                    <TH>الحالة</TH>
                  </TRow>
                </THead>
                <tbody>
                  {entries.map((e) => (
                    <TRow key={e.id}>
                      <TD>
                        <p className="font-medium text-ink-900">{e.patientName}</p>
                        {e.note && (
                          <p className="mt-0.5 max-w-52 truncate text-xs text-warm-500">
                            {e.note}
                          </p>
                        )}
                      </TD>
                      <TD className="text-warm-700">{e.preferredWindow}</TD>
                      <TD>
                        {e.priority > 0 ? (
                          <span className="numeric text-warm-700">{e.priority}</span>
                        ) : (
                          <span className="text-xs text-warm-400">—</span>
                        )}
                      </TD>
                      <TD>
                        <StatusPill tone={WAITLIST_STATUS_META[e.status].tone}>
                          {WAITLIST_STATUS_META[e.status].label}
                        </StatusPill>
                      </TD>
                    </TRow>
                  ))}
                </tbody>
              </Table>

              {/* بطاقات الموبايل */}
              <div className="mt-3 flex flex-col gap-2 md:hidden">
                {entries.map((e) => (
                  <article
                    key={e.id}
                    className="rounded-panel border border-warm-200 bg-surface-raised p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-ink-900">{e.patientName}</p>
                      <StatusPill tone={WAITLIST_STATUS_META[e.status].tone}>
                        {WAITLIST_STATUS_META[e.status].label}
                      </StatusPill>
                    </div>
                    <p className="mt-0.5 text-xs text-warm-600">
                      {e.preferredWindow}
                      {e.priority > 0 ? ` · أولوية ${e.priority}` : ""}
                    </p>
                    {e.note && (
                      <p className="mt-1 text-xs text-warm-500">{e.note}</p>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </section>

        {/* فجوات اليوم */}
        <section className="lg:col-span-3" aria-label="فجوات جدول اليوم">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink-900">فجوات جدول اليوم</h2>
            <div className="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setDateValue((d) =>
                    toDateInputValue(addDays(new Date(`${d}T00:00:00`), -1)),
                  )
                }
                aria-label="اليوم السابق"
              >
                <ChevronRight size={16} aria-hidden />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setDateValue(toDateInputValue(new Date()))}
              >
                اليوم
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setDateValue((d) =>
                    toDateInputValue(addDays(new Date(`${d}T00:00:00`), 1)),
                  )
                }
                aria-label="اليوم التالي"
              >
                <ChevronLeft size={16} aria-hidden />
              </Button>
              <span className="min-w-40 text-xs font-semibold text-ink-900">
                {formatDayLabel(new Date(`${dateValue}T00:00:00`))}
              </span>
            </div>
          </div>

          {gapsState.kind === "error" ? (
            <div
              role="alert"
              className="mt-3 flex flex-col items-start gap-2 rounded-panel border border-danger-300 bg-danger-50 px-4 py-4"
            >
              <p className="text-xs font-medium text-danger-700">
                تعذر تحميل الفجوات — تحقق من الاتصال ثم أعد المحاولة.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void refreshGaps(dateValue)}
              >
                إعادة المحاولة
              </Button>
            </div>
          ) : gapsState.kind === "loading" ? (
            <GapsSkeleton />
          ) : (
            <>
              {/* شريط نهار الطبيب — انشغال وفجوات */}
              <DayStrip
                windowStart={gapsState.windowStart}
                windowEnd={gapsState.windowEnd}
                windowMs={windowMs}
                busy={busy ?? []}
                gaps={gapsState.gaps}
              />

              {gapsState.gaps.length === 0 ? (
                <EmptyState
                  icon={CalendarDays}
                  className="mt-3"
                  title="لا فجوات شاغرة هذا اليوم"
                  description="كل فترات ساعات العمل محجوزة — إلغاء أي موعد يفتح فجوة تُقترح هنا تلقائياً، أو جرّب يوماً آخر."
                />
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {gapsState.gaps.map((gap) => (
                    <li
                      key={gap.start}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-warm-200 bg-surface-raised px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-ink-900">
                          <span className="numeric">
                            {formatTime(gap.start)} — {formatTime(gap.end)}
                          </span>
                        </p>
                        <p className="mt-0.5 text-xs text-warm-500">
                          فجوة شاغرة لمدة <span className="numeric">{gap.durationMin}</span> دقيقة
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {waiting.slice(0, 2).map((e) => (
                          <StatusPill key={e.id} tone="warning">
                            اقتراح: {e.patientName}
                          </StatusPill>
                        ))}
                        <Button
                          size="sm"
                          disabled={waiting.length === 0}
                          title={
                            waiting.length === 0
                              ? "لا مرضى في قائمة الانتظار"
                              : undefined
                          }
                          onClick={() => setBookingGap(gap)}
                        >
                          حجز في الفجوة
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      <WaitlistEntryForm
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={afterChange}
      />

      {bookingGap && (
        <BookGapModal
          gap={bookingGap}
          waiting={waiting}
          onClose={() => setBookingGap(null)}
          onBooked={afterChange}
        />
      )}
    </>
  );
}

/* ---------- شريط نهار الطبيب ---------- */

function DayStrip({
  windowStart,
  windowEnd,
  windowMs,
  busy,
  gaps,
}: {
  windowStart: string;
  windowEnd: string;
  windowMs: number;
  busy: BusyBlock[];
  gaps: GapJson[];
}) {
  const windowStartMs = Date.parse(windowStart);
  return (
    <div className="mt-3 rounded-panel border border-warm-200 bg-surface-raised px-4 py-3">
      <div
        className="relative h-7 overflow-hidden rounded-field border border-warm-200 bg-surface-sunken"
        role="img"
        aria-label={`خط نهار الطبيب من ${formatTime(windowStart)} إلى ${formatTime(windowEnd)} — فجوات شاغرة ${gaps.length}`}
      >
        {/* كتل الانشغال */}
        {busy.map((b) => (
          <span
            key={b.id}
            aria-hidden
            className="absolute inset-y-0 bg-ink-600/25"
            style={{
              insetInlineStart: `${stripPercent(b.startsAt, windowStartMs, windowMs)}%`,
              width: `${(b.durationMin / (windowMs / 60_000)) * 100}%`,
            }}
          />
        ))}
        {/* الفجوات الشاغرة */}
        {gaps.map((g) => (
          <span
            key={g.start}
            aria-hidden
            className="absolute inset-y-0 border-x border-primary-300 bg-primary-100"
            style={{
              insetInlineStart: `${stripPercent(g.start, windowStartMs, windowMs)}%`,
              width: `${(g.durationMin / (windowMs / 60_000)) * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="numeric mt-1 flex items-center justify-between text-[10px] text-warm-400">
        <span>{formatTime(windowStart)}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span aria-hidden className="size-2 rounded-sm bg-ink-600/25" />
            محجوز
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden className="size-2 rounded-sm bg-primary-100" />
            فجوة شاغرة
          </span>
        </span>
        <span>{formatTime(windowEnd)}</span>
      </div>
    </div>
  );
}

/* ---------- هياكل التحميل ---------- */

function EntriesSkeleton() {
  return (
    <div className="mt-3 flex flex-col gap-2" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-panel border border-warm-100 bg-warm-50"
          aria-hidden
        />
      ))}
    </div>
  );
}

function GapsSkeleton() {
  return (
    <div className="mt-3 flex flex-col gap-2" aria-busy="true">
      <div
        className="h-14 animate-pulse rounded-panel border border-warm-100 bg-warm-50"
        aria-hidden
      />
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-panel border border-warm-100 bg-warm-50"
          aria-hidden
        />
      ))}
    </div>
  );
}
