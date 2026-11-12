import type { AppointmentDto } from "@/lib/services/appointments";

// مساعدات عرض لوحة الطبيب — نقية بلا I/O تُختبر وحدوياً، تجمع فوق نتائج
// خدمات القائمة ولا تعيد حساب أي منطق عمل.

// مرضى اليوم = عدد المرضى الفريدين في قائمة المواعيد (للمريض الواحد أكثر من
// موعد في اليوم يُحسب مرة واحدة).
export function countDistinctPatients(
  appointments: ReadonlyArray<Pick<AppointmentDto, "patientId">>,
): number {
  return new Set(appointments.map((a) => a.patientId)).size;
}

// مواعيد نافذة زمنية [from, to) — القائمة قادمة مرتبة تصاعدياً من الخدمة
// لكن الفرز هنا صريح حتى يبقى المساعد صحيحاً بأي ترتيب إدخال.
export function appointmentsWithin(
  appointments: ReadonlyArray<AppointmentDto>,
  from: Date,
  to: Date,
): AppointmentDto[] {
  return [...appointments]
    .filter((a) => a.startsAt >= from && a.startsAt < to)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

// المواعيد القادمة = المحجوز أو المؤكد فقط (الملغي ولم-يحضر والمكتمل لا
// يُعدّ قادمة)، مرتبة بالوقت وبحد أقصى للعرض.
export function selectUpcomingAppointments(
  appointments: ReadonlyArray<AppointmentDto>,
  limit: number,
): AppointmentDto[] {
  return [...appointments]
    .filter((a) => a.status === "SCHEDULED" || a.status === "CONFIRMED")
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, limit);
}
