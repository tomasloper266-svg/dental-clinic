import { Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusPill } from "@/components/ui/Badge";
import { STATUS_META, formatDayLabel, formatTime } from "@/lib/appointment-ui";
import type { AppointmentDto } from "@/lib/services/appointments";
import type { MaterialDto } from "@/lib/services/inventory";
import type { PatientDto } from "@/lib/services/patients";

// عمود التنبيهات في لوحة الطبيب — ثلاث بطاقات صغيرة: المواعيد القادمة،
// تنبيهات نقص المخزون، وآخر المرضى المسجلين. لكل بطاقة حالة فراغ مصممة.

function PanelShell({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-panel border-warm-200 bg-surface-raised border">
      <a
        href={href}
        className="border-warm-200 text-ink-900 hover:bg-surface-hover flex items-center justify-between border-b px-4 py-3 text-sm font-semibold transition-colors"
      >
        {title}
        <span aria-hidden className="text-primary-700 text-xs">
          فتح الصفحة
        </span>
      </a>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

/** المواعيد القادمة — المحجوز والمؤكد من الآن فصاعداً */
export function UpcomingAppointmentsPanel({
  appointments,
}: {
  appointments: AppointmentDto[];
}) {
  return (
    <PanelShell title="المواعيد القادمة" href="/appointments">
      {appointments.length === 0 ? (
        <p className="text-warm-500 py-2 text-center text-xs">
          لا مواعيد قادمة هذا الأسبوع.
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
                  {formatDayLabel(appt.startsAt)} — {formatTime(appt.startsAt)}
                </p>
              </div>
              <StatusPill tone={statusPillTone[appt.status]}>
                {STATUS_META[appt.status].label}
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
export function LowStockPanel({ materials }: { materials: MaterialDto[] }) {
  return (
    <PanelShell title="تنبيهات المخزون" href="/inventory">
      {materials.length === 0 ? (
        <p className="text-warm-500 py-2 text-center text-xs">
          المخزون بحالة جيدة — لا مواد تحت الحد.
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
export function RecentPatientsPanel({
  patients,
  limit = 5,
}: {
  patients: PatientDto[];
  limit?: number;
}) {
  return (
    <PanelShell title="آخر المرضى المسجلين" href="/patients">
      {patients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="لم تسجل مرضى بعد"
          description="أضف أول مريض من صفحة المرضى."
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
