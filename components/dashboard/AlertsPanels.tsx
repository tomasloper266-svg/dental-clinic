import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/Badge";
import { STATUS_META } from "@/lib/appointment-ui";
import {
  formatDate,
  formatTime,
  getLocale,
  getServerT,
  getT,
} from "@/lib/i18n";
import type { AppointmentDto } from "@/lib/services/appointments";
import type { MaterialDto } from "@/lib/services/inventory";
import type { PatientDto } from "@/lib/services/patients";

// عمود التنبيهات في لوحة الطبيب — ثلاث بطاقات صغيرة: المواعيد القادمة،
// تنبيهات نقص المخزون، وآخر المرضى المسجلين. لكل بطاقة حالة فراغ مصممة.

async function PanelShell({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  const t = await getServerT();
  return (
    <section className="rounded-panel border-warm-200 bg-surface-raised border">
      <a
        href={href}
        className="border-warm-200 text-ink-900 hover:bg-surface-hover flex items-center justify-between border-b px-4 py-3 text-sm font-semibold transition-colors"
      >
        {title}
        <span aria-hidden className="text-primary-700 text-xs">
          {t("dashboard.openPage")}
        </span>
      </a>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

/** المواعيد القادمة — المحجوز والمؤكد من الآن فصاعداً */
export async function UpcomingAppointmentsPanel({
  appointments,
}: {
  appointments: AppointmentDto[];
}) {
  const locale = await getLocale();
  const t = getT(locale);
  const dateOpts = { weekday: "long", day: "numeric", month: "long" } as const;
  return (
    <PanelShell
      title={t("dashboard.upcomingAppointments")}
      href="/appointments"
    >
      {appointments.length === 0 ? (
        <p className="text-warm-500 py-2 text-center text-xs">
          {t("dashboard.noUpcoming")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {appointments.map((appt) => (
            <li
              key={appt.id}
              className="flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-ink-900 truncate text-sm font-medium">
                  {appt.patientName}
                </p>
                <p className="text-warm-500 text-xs">
                  {formatDate(appt.startsAt, locale, dateOpts)} —{" "}
                  {formatTime(appt.startsAt, locale)}
                </p>
              </div>
              <StatusPill tone={statusPillTone[appt.status]}>
                {t(STATUS_META[appt.status].labelKey)}
              </StatusPill>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

const statusPillTone = {
  SCHEDULED: "info",
  CONFIRMED: "success",
  IN_TREATMENT: "warning",
  COMPLETED: "neutral",
  CANCELLED: "danger",
  NO_SHOW: "neutral",
} as const;

/** تنبيهات المخزون — مواد وصلت حد التنبيه أو نزلت تحته */
export async function LowStockPanel({
  materials,
}: {
  materials: MaterialDto[];
}) {
  const t = await getServerT();
  return (
    <PanelShell title={t("dashboard.inventoryAlerts")} href="/inventory">
      {materials.length === 0 ? (
        <p className="text-warm-500 py-2 text-center text-xs">
          {t("dashboard.stockHealthy")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2">
              <span className="text-ink-900 truncate text-sm font-medium">
                {m.name}
              </span>
              <StatusPill tone="warning">
                <span className="numeric">
                  {m.quantityOnHand} / {m.minQuantity} {m.unit}
                </span>
              </StatusPill>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

/** آخر المرضى المسجلين — أحدث خمسة من قائمة المرضى (مرتبة بالأحدث) */
export async function RecentPatientsPanel({
  patients,
  limit = 5,
}: {
  patients: PatientDto[];
  limit?: number;
}) {
  const t = await getServerT();
  return (
    <PanelShell title={t("dashboard.recentPatients")} href="/patients">
      {patients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("dashboard.noPatientsTitle")}
          description={t("dashboard.noPatientsDesc")}
          className="px-4 py-6"
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {patients.slice(0, limit).map((p) => (
            <li key={p.id}>
              <a
                href={`/patients/${encodeURIComponent(p.id)}/odontogram`}
                className="rounded-field text-ink-900 hover:bg-surface-hover hover:text-primary-700 flex items-center gap-2 px-1.5 py-1 text-sm transition-colors"
              >
                <Users
                  size={16}
                  className="text-warm-400 shrink-0"
                  aria-hidden
                />
                <span className="truncate">{p.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}
