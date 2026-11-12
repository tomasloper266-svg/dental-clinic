// دوال عرض نقية لملف المريض — فصل مواعيد المريض إلى قادم وسابق للعرض.

export type DatedRecord = { startsAt: Date | string };

export type AppointmentSplit<T extends DatedRecord> = {
  /** مواعيد من لحظة الآن وما بعدها — تصاعدياً زمنياً */
  upcoming: T[];
  /** مواعيد فائتة قبل الآن — تنازلياً (الأحدث أولًا) */
  past: T[];
};

/**
 * فصل المواعيد حول لحظة now: القادم تصاعدي (أقرب موعد أولًا) والفائت
 * تنازلي (آخر زيارة أولًا). نقية — تُختبر بلا قاعدة بيانات.
 */
export function splitAppointments<T extends DatedRecord>(
  appointments: readonly T[],
  now: Date,
): AppointmentSplit<T> {
  const timeOf = (a: T) =>
    a.startsAt instanceof Date ? a.startsAt.getTime() : new Date(a.startsAt).getTime();
  const nowMs = now.getTime();

  const upcoming: T[] = [];
  const past: T[] = [];
  for (const appointment of appointments) {
    (timeOf(appointment) >= nowMs ? upcoming : past).push(appointment);
  }

  upcoming.sort((a, b) => timeOf(a) - timeOf(b));
  past.sort((a, b) => timeOf(b) - timeOf(a));
  return { upcoming, past };
}
