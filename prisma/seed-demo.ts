/**
 * بذرة بيانات تجريبية — عيادة «الابتسامة» (بيانات وهمية للعرض فقط)
 *
 * Idempotent: يمسح عيادة العرض فقط (بحسب الاسم المرجعي) ثم يعيد بناءها
 * مع بياناتها. عيادات حقيقية أخرى في نفس القاعدة لا تُمَس.
 *
 * التشغيل: npm run seed:demo
 * الدخول:  اسم المستخدم demo — كلمة السر demo1234
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

// ─── أدوات عشوائية محدَّدة البذرة (نفس البيانات عند كل تشغيل) ────────────────
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261127);
const randInt = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T,>(arr: readonly T[]): T => arr[randInt(0, arr.length - 1)];
const usd = (n: number) => n.toFixed(2);

const DEMO_CLINIC_NAME = "عيادة الابتسامة لطب الأسنان";
const DEMO_USERNAME = "demo";
const DEMO_PASSWORD = "demo1234";

// نقطة زمنية مرجعية — منتصف الليل اليوم (توقيت الخادم)
const today = new Date();
today.setHours(0, 0, 0, 0);
/** تاريخ بإزاحة أيام عن اليوم وساعة محددة */
function at(dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date(today);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

// ─── مسح عيادة العرض السابقة (إلحاقي الأبناء أولاً بسبب قيود المرجعية) ────────
async function wipeDemoClinic() {
  const previous = await prisma.clinic.findFirst({
    where: { name: DEMO_CLINIC_NAME, users: { some: { username: DEMO_USERNAME } } },
  });
  if (!previous) return;
  const clinicId = previous.id;
  await prisma.ledgerEntry.updateMany({ where: { clinicId }, data: { appliedChargeId: null } });
  await prisma.ledgerEntryItem.deleteMany({ where: { entry: { clinicId } } });
  await prisma.ledgerEntry.deleteMany({ where: { clinicId } });
  await prisma.materialUsage.deleteMany({ where: { clinicId } });
  await prisma.materialMovement.deleteMany({ where: { clinicId } });
  await prisma.appointmentReminder.deleteMany({ where: { clinicId } });
  await prisma.appointmentStatusChange.deleteMany({ where: { clinicId } });
  await prisma.instructionSend.deleteMany({ where: { clinicId } });
  await prisma.instructionTemplate.deleteMany({ where: { clinicId } });
  await prisma.verificationToken.deleteMany({ where: { user: { clinicId } } });
  await prisma.session.deleteMany({ where: { user: { clinicId } } });
  await prisma.toothFinding.deleteMany({ where: { clinicId } });
  await prisma.periodontalReading.deleteMany({ where: { clinicId } });
  await prisma.treatmentPlanItem.deleteMany({ where: { clinicId } });
  await prisma.treatmentPlan.deleteMany({ where: { clinicId } });
  await prisma.expense.deleteMany({ where: { clinicId } });
  await prisma.material.deleteMany({ where: { clinicId } });
  await prisma.waitlistEntry.deleteMany({ where: { clinicId } });
  await prisma.appointment.deleteMany({ where: { clinicId } });
  await prisma.staffMember.deleteMany({ where: { clinicId } });
  await prisma.subscriptionPayment.deleteMany({ where: { clinicId } });
  await prisma.clinicBackup.deleteMany({ where: { clinicId } });
  await prisma.patient.deleteMany({ where: { clinicId } });
  await prisma.user.deleteMany({ where: { clinicId } });
  await prisma.clinic.delete({ where: { id: clinicId } });
}

// ─── بيانات عربية واقعية ─────────────────────────────────────────────────────
const MALE_NAMES = ["أحمد", "محمد", "خالد", "عمر", "يوسف", "حسن", "طارق", "زياد", "مازن", "رامي", "فادي", "هيثم", "سامر", "ليث", "أنس", "عبدالله", "مروان", "وسيم"];
const FEMALE_NAMES = ["هدى", "رنا", "سارة", "لينا", "نور", "دانا", "رغد", "لمى", "ريم", "جودي", "بيان", "شام", "ميرا", "أميلة", "غدير", "سلمى"];
const FAMILY_NAMES = ["الحلبي", "السيد", "الخطيب", "الشامي", "الأسعد", "الحسيني", "الأحمد", "العلي", "النجار", "الديري", "الطحان", "الصباغ", "درويش", "زيدان", "الحموي", "العطار", "الجندي", "عباد", "القاضية", "المحمصي"];

const REASONS = ["فحص دوري", "حشو", "تنظيف جير", "خلع", "علاج عصب", "متابعة تقويم", "تبييض", "تركيب تاج", "ألم ضرس", "تركيب طرمس"];

const PROCEDURES: ReadonlyArray<{ name: string; price: number }> = [
  { name: "حشو ضوئي", price: 25 },
  { name: "علاج عصب (تسليك وحشو)", price: 60 },
  { name: "تاج زيركون", price: 150 },
  { name: "خلع سن", price: 20 },
  { name: "تنظيف جير وتلميع", price: 15 },
  { name: "زرعة سن", price: 400 },
  { name: "حشو عادي", price: 12 },
  { name: "تركيب طرمس", price: 90 },
];

const MATERIALS: ReadonlyArray<{ name: string; unit: string; category: string; qty: number; min: number; cost: number; supplier: string }> = [
  { name: "قفازات لاتكس", unit: "علبة", category: "مستهلكات", qty: 14, min: 5, cost: 4.5, supplier: "شركة الشفاء الطبية" },
  { name: "كمامات جراحية", unit: "علبة", category: "مستهلكات", qty: 3, min: 4, cost: 3, supplier: "شركة الشفاء الطبية" },
  { name: "مخدر ليدوكايين", unit: "عبوة", category: "أدوية", qty: 22, min: 10, cost: 12, supplier: "مخبر النور" },
  { name: "إبر تخدير", unit: "علبة", category: "مستهلكات", qty: 7, min: 3, cost: 6, supplier: "مخبر النور" },
  { name: "حشو ضوئي (كومبوزيت)", unit: "عبوة", category: "حشوات", qty: 5, min: 2, cost: 35, supplier: "دنتال سوبلاي" },
  { name: "حمض حفر", unit: "عبوة", category: "حشوات", qty: 8, min: 3, cost: 9, supplier: "دنتال سوبلاي" },
  { name: "أسمنت لاصق", unit: "عبوة", category: "حشوات", qty: 4, min: 2, cost: 18, supplier: "دنتال سوبلاي" },
  { name: "طقم أدوات جراحة", unit: "طقم", category: "أدوات", qty: 6, min: 2, cost: 75, supplier: "الشركة السورية للأجهزة" },
  { name: "مادة تبييض", unit: "طقم", category: "تجميل", qty: 3, min: 1, cost: 45, supplier: "دنتال سوبلاي" },
  { name: "رول قطن", unit: "رول", category: "مستهلكات", qty: 20, min: 8, cost: 2.5, supplier: "شركة الشفاء الطبية" },
  { name: "ورق أشعة", unit: "علبة", category: "أشعة", qty: 2, min: 3, cost: 11, supplier: "مخبر النور" },
  { name: "معجون طبع (سيليكون)", unit: "عبوة", category: "طبع", qty: 5, min: 2, cost: 28, supplier: "دنتال سوبلاي" },
  { name: "محلول تعقيم", unit: "جالون", category: "تعقيم", qty: 6, min: 3, cost: 8, supplier: "شركة الشفاء الطبية" },
  { name: "أسلاك تقويم", unit: "علبة", category: "تقويم", qty: 1, min: 4, cost: 15, supplier: "أورثو بلس" },
  { name: "رباط تقويم مطاطي", unit: "علبة", category: "تقويم", qty: 10, min: 4, cost: 5, supplier: "أورثو بلس" },
];

async function main() {
  await wipeDemoClinic();

  // ─── العيادة ───────────────────────────────────────────────────────────────
  // اشتراك مدفوع سنة قادمة → الحالة مشتقة ACTIVE دائماً (now ≤ subscriptionEndsAt)
  const clinic = await prisma.clinic.create({
    data: {
      name: DEMO_CLINIC_NAME,
      usdRate: 15000,
      currency: "USD",
      logoLetter: "ا",
      openingBalance: 5000,
      workStart: "09:00 AM",
      workEnd: "09:00 PM",
      trialEndsAt: today,
      subscriptionEndsAt: at(365, 12),
    },
  });

  // ─── حساب المالك + الطاقم ──────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const owner = await prisma.user.create({
    data: {
      clinicId: clinic.id,
      name: "د. سامر الأسعد",
      phone: "0930000001",
      username: DEMO_USERNAME,
      passwordHash,
      role: "DENTIST",
      email: "demo@smile-clinic.sy",
      emailVerifiedAt: new Date(),
    },
  });

  const staff = await Promise.all([
    prisma.staffMember.create({
      data: {
        clinicId: clinic.id,
        name: "د. خالد الحلبي",
        role: "DENTIST",
        specialty: "علاج الجذور والحشوات",
        phone: "0933100101",
        commissionPercent: 40,
        colorHex: "#2563eb",
        scheduleNote: "الطابق الأول — كرسي 2",
      },
    }),
    prisma.staffMember.create({
      data: {
        clinicId: clinic.id,
        name: "د. مريم العلي",
        role: "DENTIST",
        specialty: "تقويم الأسنان",
        phone: "0933100102",
        commissionPercent: 35,
        colorHex: "#9333ea",
        scheduleNote: "الطابق الأول — كرسي 3",
      },
    }),
    prisma.staffMember.create({
      data: {
        clinicId: clinic.id,
        name: "ريما الحسن",
        role: "RECEPTION",
        phone: "0933100103",
        colorHex: "#0d9488",
      },
    }),
    prisma.staffMember.create({
      data: {
        clinicId: clinic.id,
        name: "نور الشامي",
        role: "ASSISTANT",
        phone: "0933100104",
        colorHex: "#d97706",
      },
    }),
  ]);
  const dentists = [staff[0], staff[1]];

  // ─── المرضى ────────────────────────────────────────────────────────────────
  const patientCount = 26;
  const usedNames = new Set<string>();
  const patients: { id: string; name: string }[] = [];
  for (let i = 1; i <= patientCount; i++) {
    let name = "";
    do {
      const first = pick(MALE_NAMES.concat(FEMALE_NAMES));
      name = `${first} ${pick(FAMILY_NAMES)}`;
    } while (usedNames.has(name));
    usedNames.add(name);
    const gender = MALE_NAMES.includes(name.split(" ")[0]) ? "MALE" : "FEMALE";
    const hasHistory = rnd() < 0.4;
    const patient = await prisma.patient.create({
      data: {
        clinicId: clinic.id,
        name,
        fileNo: i,
        birthYear: randInt(1965, 2008),
        gender,
        phone: `094${randInt(1000000, 9999999)}`,
        secondaryPhone: rnd() < 0.3 ? `095${randInt(1000000, 9999999)}` : null,
        address: pick(["دمشق - المزة", "دمشق - الشعلان", "ريف دمشق - جرمانا", "ريف دمشق - صحنايا", "دمشق - البرامكة", "دمشق - الميدان"]),
        medicalNotes: hasHistory ? pick(["حساسية بينسلين", "ضغط دم مرتفع — تتناول أملوديبين", "سكري نوع ٢ — غلوكوفاج", "حساسية موسمية", "حمل — الشهر السادس"]) : null,
        allergies: rnd() < 0.25 ? pick(["حساسية بنسلين", "حساسية لاتكس", "حساسية أسبرين"]) : null,
        bloodType: rnd() < 0.6 ? pick(["O+", "A+", "B+", "AB+", "O-", "A-"]) : null,
      },
      select: { id: true, name: true },
    });
    patients.push(patient);
  }

  // ─── المواعيد + تاريخ الحالات ──────────────────────────────────────────
  // أمسِ وأقدم: منجزة بالدرجة الأولى مع بعض الملغى/الغياب — تغذي التقارير والإيراد
  for (let offset = -62; offset <= -1; offset++) {
    const weekday = at(offset, 10).getDay();
    if (weekday === 5) continue; // جمعة — العطلة
    const slots = randInt(1, 3);
    for (let s = 0; s < slots; s++) {
      const hour = pick([9, 10, 11, 12, 13, 15, 16, 17, 18, 19]);
      const patient = pick(patients);
      const doctor = pick(dentists);
      const roll = rnd();
      const status = roll < 0.78 ? "COMPLETED" : roll < 0.9 ? "CANCELLED" : "NO_SHOW";
      const appt = await prisma.appointment.create({
        data: {
          clinicId: clinic.id,
          patientId: patient.id,
          staffId: doctor.id,
          startsAt: at(offset, hour, pick([0, 30])),
          durationMin: pick([30, 30, 45, 60]),
          status,
          reason: pick(REASONS),
          note: rnd() < 0.2 ? pick(["أبلغ المريض بالمتابعة بعد أسبوعين", "المريض متأخر عن موعده", "تمت المتابعة هاتفياً"]) : null,
        },
        select: { id: true, patientId: true, startsAt: true, status: true, staffId: true },
      });
      await prisma.appointmentStatusChange.create({
        data: {
          clinicId: clinic.id,
          appointmentId: appt.id,
          fromStatus: "SCHEDULED",
          toStatus: status,
          changedById: owner.id,
          createdAt: appt.startsAt,
        },
      });
    }
  }

  // اليوم: مواعيد بساعات متفرقة — يبدو الجدول حياً في اللوحة والمخطط الزمني
  const todaySlots: ReadonlyArray<{ hour: number; min: number; status: "SCHEDULED" | "CONFIRMED" | "IN_TREATMENT" | "COMPLETED" }> = [
    { hour: 9, min: 0, status: "COMPLETED" },
    { hour: 10, min: 30, status: "COMPLETED" },
    { hour: 11, min: 30, status: "IN_TREATMENT" },
    { hour: 12, min: 30, status: "CONFIRMED" },
    { hour: 15, min: 0, status: "SCHEDULED" },
    { hour: 16, min: 30, status: "CONFIRMED" },
    { hour: 18, min: 0, status: "SCHEDULED" },
    { hour: 19, min: 30, status: "SCHEDULED" },
  ];
  const todayAppointments: { id: string }[] = [];
  for (const slot of todaySlots) {
    const patient = pick(patients);
    const doctor = pick(dentists);
    const appt = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        staffId: doctor.id,
        startsAt: at(0, slot.hour, slot.min),
        durationMin: pick([30, 45, 60]),
        status: slot.status,
        reason: pick(REASONS),
      },
      select: { id: true },
    });
    todayAppointments.push(appt);
    if (slot.status !== "SCHEDULED") {
      await prisma.appointmentStatusChange.create({
        data: { clinicId: clinic.id, appointmentId: appt.id, fromStatus: "SCHEDULED", toStatus: slot.status, changedById: owner.id },
      });
    }
  }
  // تذكيرات واتساب أُرسلت لبعض مواعيد اليوم
  for (const appt of todayAppointments.slice(0, 3)) {
    await prisma.appointmentReminder.create({
      data: { clinicId: clinic.id, appointmentId: appt.id, sentById: owner.id, sentAt: at(0, 8, 15) },
    });
  }

  // القادم: أسبوعان قادمان — مواعيد مؤكدة ومجدولة
  for (let offset = 1; offset <= 14; offset++) {
    const weekday = at(offset, 10).getDay();
    if (weekday === 5) continue;
    for (let s = 0; s < randInt(1, 2); s++) {
      await prisma.appointment.create({
        data: {
          clinicId: clinic.id,
          patientId: pick(patients).id,
          staffId: pick(dentists).id,
          startsAt: at(offset, pick([10, 11, 12, 16, 17, 18]), pick([0, 30])),
          durationMin: pick([30, 45, 60]),
          status: rnd() < 0.5 ? "SCHEDULED" : "CONFIRMED",
          reason: pick(REASONS),
        },
      });
    }
  }

  // ─── قائمة الانتظار ────────────────────────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    await prisma.waitlistEntry.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[i + 7].id,
        preferredWindow: pick(["صباحاً (9–12)", "مساءً (5–8)", "أي وقت مناسب"]),
        priority: i,
        status: i === 2 ? "OFFERED" : "WAITING",
        note: i === 0 ? "طلب موعد عاجل — ألم" : null,
      },
    });
  }

  // ─── مخططات الأسنان (FDI) وخطط العلاج ─────────────────────────────────────
  for (let i = 0; i < 10; i++) {
    const patient = patients[i];
    const findings = [
      { toothFdi: 16, kind: "EXISTING" as const, status: "FILLED" as const, surface: "O" },
      { toothFdi: 26, kind: "DIAGNOSIS" as const, status: "DECAYED" as const, surface: "O+D" },
      { toothFdi: 36, kind: "DIAGNOSIS" as const, status: "DECAYED" as const, surface: "O+M+D" },
      { toothFdi: 46, kind: "TREATMENT_DONE" as const, status: "ROOT_CANAL" as const, surface: null },
      { toothFdi: 11, kind: "EXISTING" as const, status: "CROWN" as const, surface: null },
      { toothFdi: 38, kind: "TREATMENT_DONE" as const, status: "EXTRACTED" as const, surface: null },
    ].slice(0, randInt(3, 6));
    for (const f of findings) {
      await prisma.toothFinding.create({
        data: {
          clinicId: clinic.id,
          patientId: patient.id,
          toothFdi: f.toothFdi,
          kind: f.kind,
          status: f.status,
          surface: f.surface,
          recordedById: owner.id,
          note: f.status === "DECAYED" ? "تسوس متوسط — يحتاج حشواً" : null,
        },
      });
    }
  }
  for (let i = 0; i < 2; i++) {
    const patient = patients[i + 3];
    for (const tooth of [16, 26]) {
      await prisma.periodontalReading.create({
        data: {
          clinicId: clinic.id,
          patientId: patient.id,
          toothFdi: tooth,
          pocketDepthMm: randInt(2, 5),
          recessionMm: randInt(0, 2),
          bleedingOnProbing: rnd() < 0.4,
          mobilityGrade: rnd() < 0.3 ? 1 : 0,
          recordedById: owner.id,
        },
      });
    }
  }
  for (let i = 0; i < 6; i++) {
    const patient = patients[i + 2];
    const plan = await prisma.treatmentPlan.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        name: pick(["خطة العلاج الشاملة", "خطة ترميمية", "خطة تجميل الأسنان"]),
        planDate: at(-randInt(5, 40), 11),
        doctorName: pick(dentists).name,
        notes: rnd() < 0.5 ? "نوقشت الخطة مع المريض ووافق على المرحلة الأولى" : null,
      },
      select: { id: true },
    });
    const itemCount = randInt(2, 4);
    for (let j = 0; j < itemCount; j++) {
      const proc = pick(PROCEDURES);
      const status = j === 0 ? "DONE" : rnd() < 0.5 ? "ACCEPTED" : "PROPOSED";
      await prisma.treatmentPlanItem.create({
        data: {
          clinicId: clinic.id,
          patientId: patient.id,
          planId: plan.id,
          toothFdi: pick([11, 16, 21, 26, 36, 46, 47]),
          surface: pick(["O", "O+D", "M+D", null]),
          procedure: proc.name,
          priceUsd: usd(proc.price),
          status,
          priority: j,
        },
      });
    }
  }

  // ─── المالية: رسوم ودفعات على شهرين + مصاريف ───────────────────────────────
  let invoiceSeq = 0;
  const chargesByPatient = new Map<string, { charged: number; paid: number }>();
  for (let offset = -60; offset <= 0; offset++) {
    const chargeCount = rnd() < 0.55 ? randInt(1, 2) : 0;
    for (let c = 0; c < chargeCount; c++) {
      const patient = pick(patients);
      const doctor = pick(dentists);
      const proc = pick(PROCEDURES);
      const createdAt = at(offset, randInt(9, 19), pick([0, 15, 30, 45]));
      invoiceSeq++;
      await prisma.ledgerEntry.create({
        data: {
          clinicId: clinic.id,
          patientId: patient.id,
          type: "CHARGE",
          amountUsd: usd(proc.price),
          note: proc.name,
          createdById: owner.id,
          createdAt,
          invoiceSeq,
          doctorId: doctor.id,
          items: {
            create: { description: proc.name, category: proc.name.split(" ")[0], amountUsd: usd(proc.price), sort: 0 },
          },
        },
      });
      const agg = chargesByPatient.get(patient.id) ?? { charged: 0, paid: 0 };
      agg.charged += proc.price;
      // دفعة جزئية أو كاملة أو مؤجلة — لخلط ذمم المرضى
      const roll = rnd();
      if (roll < 0.55) {
        const paid = Math.round(proc.price * (roll < 0.3 ? 1 : 0.5));
        await prisma.ledgerEntry.create({
          data: {
            clinicId: clinic.id,
            patientId: patient.id,
            type: "PAYMENT",
            amountUsd: usd(paid),
            note: roll < 0.3 ? "سداد كامل" : "دفعة على الحساب",
            createdById: owner.id,
            createdAt: new Date(createdAt.getTime() + 45 * 60 * 1000),
          },
        });
        agg.paid += paid;
      }
      chargesByPatient.set(patient.id, agg);
    }
  }
  // تصحيح واسترداد عرضيان
  const aggPatient = pick(patients);
  await prisma.ledgerEntry.create({
    data: { clinicId: clinic.id, patientId: aggPatient.id, type: "ADJUSTMENT", amountUsd: usd(5), note: "خصم تعاطف", createdById: owner.id, createdAt: at(-3, 12) },
  });
  await prisma.ledgerEntry.create({
    data: { clinicId: clinic.id, patientId: pick(patients).id, type: "REFUND", amountUsd: usd(20), note: "استرداد دفعة بعد إلغاء الخطة", createdById: owner.id, createdAt: at(-10, 15) },
  });

  const EXPENSE_CATEGORIES = ["رواتب", "إيجار", "مواد ومستلزمات", "كهرباء وماء", "صيانة أجهزة", "دعاية"] as const;
  for (let offset = -60; offset <= 0; offset += randInt(2, 6)) {
    await prisma.expense.create({
      data: {
        clinicId: clinic.id,
        category: pick(EXPENSE_CATEGORIES),
        amountUsd: usd(randInt(15, 450)),
        note: rnd() < 0.5 ? pick(["فاتورة شهرية", "دورية موردة", "إصلاح كرسي الأسنان"]) : null,
        spentAt: at(offset, randInt(10, 18)),
      },
    });
  }

  // ─── المخزون: ٣ مواد تحت الحد الأدنى لتشغيل تنبيه النقص ────────────────────
  for (const m of MATERIALS) {
    await prisma.material.create({
      data: {
        clinicId: clinic.id,
        name: m.name,
        unit: m.unit,
        category: m.category,
        supplier: m.supplier,
        quantityOnHand: usd(m.qty),
        minQuantity: usd(m.min),
        costUsd: usd(m.cost),
        movements: {
          create: {
            clinicId: clinic.id,
            quantityChange: usd(m.qty),
            note: "توريد افتتاحي",
            recordedById: owner.id,
            movedAt: at(-30, 10),
          },
        },
      },
    });
  }

  // ─── قوالب التعليمات + سجل إرسال ───────────────────────────────────────────
  const template1 = await prisma.instructionTemplate.create({
    data: {
      clinicId: clinic.id,
      procedure: "خلع سن",
      body: "الأكل بعد ساعتين من الخلع، ويمضغ على الجهة الأخرى. ممسك بالثلج ١٥ دقيقة كل ساعة ليوم كامل. تجنب المضمضة الحارة والغليانة اليوم الأول. عند نزيف بسيط اعضض على شاش قطن ٣٠ دقيقة. أعد زيارتنا عند ألم شديد أو نزيف مستمر.",
    },
  });
  await prisma.instructionTemplate.create({
    data: {
      clinicId: clinic.id,
      procedure: "حشو عصب",
      body: "من الطبيعي وجود ألم خفيف عند العض ٢–٣ أيام بعد جلسة العصب. تجنب العض على السن المعالج حتى تركيب الحشو النهائي. تناول المسكن المعتاد عند اللزوم. أكمل باقي جلسات العلاج في موعدها كي لا يتأكسد الحشو المؤقت.",
    },
  });
  await prisma.instructionSend.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[0].id,
      templateId: template1.id,
      procedure: "خلع سن",
      body: "الأكل بعد ساعتين من الخلع، ويمضغ على الجهة الأخرى. ممسك بالثلج ١٥ دقيقة كل ساعة ليوم كامل.",
      channel: "WHATSAPP",
      sentById: owner.id,
      sentAt: at(-2, 13),
    },
  });
  await prisma.instructionSend.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[1].id,
      procedure: "حشو عصب",
      body: "من الطبيعي وجود ألم خفيف عند العض ٢–٣ أيام بعد جلسة العصب.",
      channel: "TEXT",
      sentById: owner.id,
      sentAt: at(-6, 16),
    },
  });

  // ─── سجل اشتراك: حوالة سنوية معتمدة (١٢٠$ سعر الباقة) ─────────────────────
  await prisma.subscriptionPayment.create({
    data: {
      clinicId: clinic.id,
      plan: "YEARLY",
      amountUsd: "120.00",
      transferRef: "SC-DEMO-2026-001",
      status: "APPROVED",
      decidedAt: at(-20, 10),
      createdAt: at(-20, 10),
    },
  });

  // ─── ملخص تحقق ────────────────────────────────────────────────────────────
  const [patientN, apptTodayN, waitN, chargeN, paymentN] = await Promise.all([
    prisma.patient.count({ where: { clinicId: clinic.id } }),
    prisma.appointment.count({ where: { clinicId: clinic.id, startsAt: { gte: today, lt: at(1, 0) } } }),
    prisma.waitlistEntry.count({ where: { clinicId: clinic.id } }),
    prisma.ledgerEntry.count({ where: { clinicId: clinic.id, type: "CHARGE" } }),
    prisma.ledgerEntry.count({ where: { clinicId: clinic.id, type: "PAYMENT" } }),
  ]);
  const materialLowN = MATERIALS.filter((m) => m.qty < m.min).length;
  console.log(
    `تمت تعبئة عيادة العرض — المرضى: ${patientN}، مواعيد اليوم: ${apptTodayN}، قائمة الانتظار: ${waitN}، قيود الرسوم: ${chargeN}، الدفعات: ${paymentN}، مواد تحت الحد: ${materialLowN}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
