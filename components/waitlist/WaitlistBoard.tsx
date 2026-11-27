"use client";
import { useI18n } from "@/components/i18n/I18nProvider";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  SearchX,
  UserPlus,
} from "lucide-react";
import { addDays, toDateInputValue } from "@/lib/dates";
import { formatDayLabel, formatTime } from "@/lib/appointment-ui";
import {
  WAITLIST_STATUS_META,
  WAITLIST_STATUS_ORDER,
  filterWaitlistEntries,
  stripPercent,
  suggestEntriesForGap,
  type WaitlistStatusFilter,
} from "@/lib/waitlist-view";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { EntityCell } from "@/components/ui/EntityCell";
import { PillAction } from "@/components/ui/TableActions";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import {
  FilterPills,
  PanelToolbar,
  SearchInput,
} from "@/components/ui/Toolbar";
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
  const { t } = useI18n();
  const [entries, setEntries] = useState<WaitlistEntryJson[] | null>(null);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [dateValue, setDateValue] = useState(initialDate);
  const [gapsState, setGapsState] = useState<GapsState>({ kind: "loading" });
  const [busy, setBusy] = useState<BusyBlock[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [bookingGap, setBookingGap] = useState<GapJson | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<WaitlistStatusFilter>("all");

  const refreshEntries = useCallback(async () => {
    setEntriesError(null);
    try {
      const res = await fetch("/api/waitlist");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { entries: WaitlistEntryJson[] };
      setEntries(data.entries);
    } catch {
      setEntriesError(t("waitlist.loadFailed"));
    }
  }, [t]);

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

  /** المرضى المعروضون بعد البحث والتصفية — النقاء في lib/waitlist-view. */
  const visibleEntries = useMemo(
    () => (entries ? filterWaitlistEntries(entries, query, statusFilter) : []),
    [entries, query, statusFilter],
  );

  const windowMs =
    gapsState.kind === "loaded"
      ? Date.parse(gapsState.windowEnd) - Date.parse(gapsState.windowStart)
      : 0;

  return (
    <>
      <PageHeader
        title={t("common.waitlist")}
        description={t("waitlist.boardHint")}
        actions={
          <Button onClick={() => setAdding(true)}>
            <UserPlus size={16} aria-hidden />
            {t("waitlist.addPatient")}
          </Button>
        }
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-5">
        {/* قائمة المرضى المنتظرين — بطاقة محتوى بشريط بحث وتصفية */}
        <section className="lg:col-span-2" aria-label={t("waitlist.patientsWaiting")}>
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                {t("waitlist.waitingPatients")}
                {entries && entries.length > 0 && (
                  <span className="numeric ms-2 text-xs font-normal text-warm-500">
                    {entries.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>

            <PanelToolbar className="border-b border-warm-200 px-5">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder={t("patients.searchNotesPlaceholder")}
                aria-label={t("waitlist.search")}
              />
              <FilterPills
                ariaLabel={t("waitlist.filterByStatus")}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: "all", label: t("common.all") },
                  ...WAITLIST_STATUS_ORDER.map((status) => ({
                    value: status,
                    label: WAITLIST_STATUS_META[status].label,
                  })),
                ]}
              />
            </PanelToolbar>

            <div className="p-5">
              {entriesError ? (
                <div
                  role="alert"
                  className="flex flex-col items-start gap-2 rounded-panel border border-danger-300 bg-danger-50 px-4 py-4"
                >
                  <p className="text-xs font-medium text-danger-700">{entriesError}</p>
                  <Button variant="secondary" size="sm" onClick={() => void refreshEntries()}>
                    {t("common.retry")}
                  </Button>
                </div>
              ) : entries === null ? (
                <EntriesSkeleton />
              ) : entries.length === 0 ? (
                <EmptyState
                  icon={Hourglass}
                  title={t("waitlist.nobody")}
                  description={t("waitlist.emptyAction")}
                  action={
                    <Button size="sm" onClick={() => setAdding(true)}>
                      <UserPlus size={14} aria-hidden />
                      {t("waitlist.addPatient")}
                    </Button>
                  }
                />
              ) : visibleEntries.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title={t("common.noMatches")}
                  description={t("patients.noMatchFilter")}
                />
              ) : (
                <>
                  {/* صفوف كيان بالأفاتار — الشاشات المتوسطة فأعلى */}
                  <ul className="hidden flex-col divide-y divide-warm-100 md:flex">
                    {visibleEntries.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <EntityCell
                          name={e.patientName}
                          subtitle={e.note ?? e.preferredWindow}
                          className="min-w-0"
                        />
                        <span className="flex shrink-0 items-center gap-2">
                          {e.preferredWindow && e.note && (
                            <span className="numeric hidden text-xs text-warm-500 lg:inline">
                              {e.preferredWindow}
                            </span>
                          )}
                          {e.priority > 0 ? (
                            <Badge tone="warning">
                              {t("plans.priority")} <span className="numeric">{e.priority}</span>
                            </Badge>
                          ) : (
                            <Badge tone="neutral">{t("odontogram.ordinary")}</Badge>
                          )}
                          <StatusPill tone={WAITLIST_STATUS_META[e.status].tone}>
                            {WAITLIST_STATUS_META[e.status].label}
                          </StatusPill>
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* بطاقات الموبايل */}
                  <ul className="flex flex-col gap-2 md:hidden">
                    {visibleEntries.map((e) => (
                      <li
                        key={e.id}
                        className="rounded-panel border border-warm-200 bg-surface-raised p-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <EntityCell
                            name={e.patientName}
                            subtitle={e.preferredWindow}
                            className="min-w-0"
                          />
                          <StatusPill tone={WAITLIST_STATUS_META[e.status].tone}>
                            {WAITLIST_STATUS_META[e.status].label}
                          </StatusPill>
                        </div>
                        {e.priority > 0 && (
                          <Badge tone="warning" className="mt-2">
                            {t("plans.priority")} <span className="numeric">{e.priority}</span>
                          </Badge>
                        )}
                        {e.note && (
                          <p className="mt-1 text-xs text-warm-500">{e.note}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Card>
        </section>

        {/* فجوات اليوم — بطاقة محتوى بترويسة وتنقل يوم */}
        <section className="lg:col-span-3" aria-label={t("waitlist.dayGaps")}>
          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{t("waitlist.dayGaps")}</CardTitle>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setDateValue((d) =>
                      toDateInputValue(addDays(new Date(`${d}T00:00:00`), -1)),
                    )
                  }
                  aria-label={t("common.previousDay")}
                >
                  <ChevronRight size={16} aria-hidden />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDateValue(toDateInputValue(new Date()))}
                >
                  {t("common.today")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setDateValue((d) =>
                      toDateInputValue(addDays(new Date(`${d}T00:00:00`), 1)),
                    )
                  }
                  aria-label={t("common.nextDay")}
                >
                  <ChevronLeft size={16} aria-hidden />
                </Button>
                <span className="min-w-40 text-xs font-semibold text-ink-900">
                  {formatDayLabel(new Date(`${dateValue}T00:00:00`))}
                </span>
              </div>
            </CardHeader>

            <CardBody>
              {gapsState.kind === "error" ? (
                <div
                  role="alert"
                  className="flex flex-col items-start gap-2 rounded-panel border border-danger-300 bg-danger-50 px-4 py-4"
                >
                  <p className="text-xs font-medium text-danger-700">
                    {t("waitlist.gapsLoadFailed")}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void refreshGaps(dateValue)}
                  >
                    {t("common.retry")}
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
                      title={t("waitlist.noGaps")}
                      description={t("waitlist.noGapsHint")}
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
                              {t("waitlist.gapDuration")} <span className="numeric">{gap.durationMin}</span> {t("common.minutes")}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {waiting.slice(0, 2).map((e) => (
                              <StatusPill key={e.id} tone="warning">
                                {t("waitlist.suggestion")} {e.patientName}
                              </StatusPill>
                            ))}
                            <PillAction
                              onClick={() => setBookingGap(gap)}
                              disabled={waiting.length === 0}
                              title={
                                waiting.length === 0
                                  ? t("waitlist.empty")
                                  : undefined
                              }
                            >
                              {t("waitlist.bookInGap")}
                            </PillAction>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </CardBody>
          </Card>
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
  const { t } = useI18n();
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
            {t("waitlist.bookedShort")}
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden className="size-2 rounded-sm bg-primary-100" />
            {t("waitlist.openGap")}
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
