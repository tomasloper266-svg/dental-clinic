// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/db";
import { createClinicWithOwner } from "@/lib/auth/create-clinic";
import {
  createPaymentRequest,
  approvePaymentRequest,
  rejectPaymentRequest,
  parsePaymentRequestInput,
} from "@/lib/billing/requests";
import {
  activateClinicManually,
  parseManualActivationInput,
} from "@/lib/billing/manual-activation";
import { getSubscriptionState } from "@/lib/billing/state";
import { SUBSCRIPTION_PLANS } from "@/lib/billing/plans";
import {
  verifyPlatformAdminKey,
  isAdminSession,
  adminSessionCookieValue,
} from "@/lib/auth/admin";

// اختبارات تكامل دورة حياة الاشتراك كاملة — تحتاج قاعدة بيانات حقيقية،
// تُتخطى بدون DATABASE_URL (نمط باقي اختبارات التكامل).
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

const DAY = 24 * 60 * 60 * 1000;
const CLINIC_NAME = "عيادة اشتراكات (اختبار)";
const PHONE = "0955555666";

let clinicId: string;

async function cleanDb(): Promise<void> {
  const clinics = await prisma.clinic.findMany({
    where: { name: CLINIC_NAME },
    select: { id: true },
  });
  for (const clinic of clinics) {
    await prisma.subscriptionPayment.deleteMany({
      where: { clinicId: clinic.id },
    });
    await prisma.user.deleteMany({ where: { clinicId: clinic.id } });
    await prisma.clinic.delete({ where: { id: clinic.id } });
  }
}

beforeAll(async () => {
  await cleanDb();
  const created = await createClinicWithOwner({
    clinicName: CLINIC_NAME,
    name: "د. اشتراكات",
    phone: PHONE,
    username: "test-subscription-owner",
    password: "subscription-pass-1",
  });
  clinicId = created.clinicId;
});

afterAll(cleanDb);

// معيار التحقق 1 — التسجيل يمنح 15 يوماً بالضبط (بهامش ثوانٍ)
describeDb("التسجيل يمنح تجربة 15 يوماً", () => {
  it("trialEndsAt = الآن + 15 يوماً عند إنشاء العيادة", async () => {
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: { trialEndsAt: true, subscriptionEndsAt: true },
    });
    const expected = Date.now() + 15 * DAY;
    expect(Math.abs(clinic.trialEndsAt!.getTime() - expected)).toBeLessThan(
      60_000,
    );
    expect(clinic.subscriptionEndsAt).toBeNull();
  });
});

// معيارا التحقق 4 و5 — طلب التفعيل وتفرد الحوالة والتمديد التراكمي
describeDb("طلبات التفعيل وقراراتها", () => {
  it("يوسّط طلباً صحيحاً بحالة PENDING", async () => {
    const result = await createPaymentRequest(clinicId, {
      plan: "MONTHLY",
      transferRef: "TR-FLOW-001",
      amountUsd: SUBSCRIPTION_PLANS.MONTHLY.priceUsd,
    });
    expect(result.ok).toBe(true);

    const payment = await prisma.subscriptionPayment.findFirstOrThrow({
      where: { clinicId, transferRef: "TR-FLOW-001" },
    });
    expect(payment.status).toBe("PENDING");
    expect(payment.decidedAt).toBeNull();
  });

  it("يرفض مبلغاً لا يطابق سعر الباقة", async () => {
    const result = await createPaymentRequest(clinicId, {
      plan: "MONTHLY",
      transferRef: "TR-FLOW-002",
      amountUsd: 10,
    });
    expect(result.ok).toBe(false);
  });

  it("يعيد استخدام رقم حوالة معتمد سابقاً برفض صريح", async () => {
    // اعتماد الطلب الأول أولاً
    const payment = await prisma.subscriptionPayment.findFirstOrThrow({
      where: { clinicId, transferRef: "TR-FLOW-001" },
    });
    const approved = await approvePaymentRequest(payment.id);
    expect(approved.ok).toBe(true);

    // محاولة إعادة استخدام رقم الحوالة المعتمد نفسه
    const reused = await createPaymentRequest(clinicId, {
      plan: "MONTHLY",
      transferRef: "TR-FLOW-001",
      amountUsd: SUBSCRIPTION_PLANS.MONTHLY.priceUsd,
    });
    expect(reused.ok).toBe(false);

    // حتى الطلب المعلق برقم معتمد يُرفض — الحماية على المعتمدين حصراً
    const pendingDuplicate = await createPaymentRequest(clinicId, {
      plan: "YEARLY",
      transferRef: "TR-FLOW-001",
      amountUsd: SUBSCRIPTION_PLANS.YEARLY.priceUsd,
    });
    expect(pendingDuplicate.ok).toBe(false);
  });

  it("اعتماد شهري بلا اشتراك قائم → +30 يوماً من اليوم", async () => {
    const clinic = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: { subscriptionEndsAt: true },
    });
    const expected = Date.now() + 30 * DAY;
    expect(
      Math.abs(clinic.subscriptionEndsAt!.getTime() - expected),
    ).toBeLessThan(60_000);
  });

  it("دفع قبل انتهاء الاشتراك → تمديد تراكمي من نهايته لا من اليوم", async () => {
    const before = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: { subscriptionEndsAt: true },
    });
    const currentEnd = before.subscriptionEndsAt!;

    const request = await createPaymentRequest(clinicId, {
      plan: "YEARLY",
      transferRef: "TR-FLOW-003",
      amountUsd: SUBSCRIPTION_PLANS.YEARLY.priceUsd,
    });
    expect(request.ok).toBe(true);
    const payment = await prisma.subscriptionPayment.findFirstOrThrow({
      where: { clinicId, transferRef: "TR-FLOW-003" },
    });
    const approved = await approvePaymentRequest(payment.id);
    expect(approved.ok).toBe(true);

    const after = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: { subscriptionEndsAt: true },
    });
    expect(after.subscriptionEndsAt!.getTime()).toBe(
      currentEnd.getTime() + 365 * DAY,
    );
  });

  it("الرفض يسجل السبب ويعيد الطلب بحالة REJECTED", async () => {
    const request = await createPaymentRequest(clinicId, {
      plan: "MONTHLY",
      transferRef: "TR-FLOW-004",
      amountUsd: SUBSCRIPTION_PLANS.MONTHLY.priceUsd,
    });
    expect(request.ok).toBe(true);
    const payment = await prisma.subscriptionPayment.findFirstOrThrow({
      where: { clinicId, transferRef: "TR-FLOW-004" },
    });

    const rejected = await rejectPaymentRequest(
      payment.id,
      "الحوالة غير موجودة",
    );
    expect(rejected.ok).toBe(true);

    const updated = await prisma.subscriptionPayment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(updated.status).toBe("REJECTED");
    expect(updated.note).toBe("الحوالة غير موجودة");
    expect(updated.decidedAt).not.toBeNull();
  });

  it("لا يُقبل طلب ثانٍ ما دام هناك طلب معلق", async () => {
    const request = await createPaymentRequest(clinicId, {
      plan: "MONTHLY",
      transferRef: "TR-FLOW-005",
      amountUsd: SUBSCRIPTION_PLANS.MONTHLY.priceUsd,
    });
    expect(request.ok).toBe(true);

    const second = await createPaymentRequest(clinicId, {
      plan: "MONTHLY",
      transferRef: "TR-FLOW-006",
      amountUsd: SUBSCRIPTION_PLANS.MONTHLY.priceUsd,
    });
    expect(second.ok).toBe(false);
  });
});

// الدفع المبكر والتفعيل اليدوي — عيادتها الخاصة كي لا تختلط معلقات أعلاه
describeDb("الدفع المبكر والتفعيل اليدوي الإداري", () => {
  const EARLY_PHONE = "0955555777";
  const EARLY_NAME = "عيادة دفع مبكر (اختبار)";
  let earlyClinicId: string;

  async function cleanEarlyDb(): Promise<void> {
    const clinics = await prisma.clinic.findMany({
      where: { name: { in: [EARLY_NAME, "عيادة محجوبة (اختبار)"] } },
      select: { id: true },
    });
    for (const clinic of clinics) {
      await prisma.subscriptionPayment.deleteMany({
        where: { clinicId: clinic.id },
      });
      await prisma.user.deleteMany({ where: { clinicId: clinic.id } });
      await prisma.clinic.delete({ where: { id: clinic.id } });
    }
  }

  beforeAll(async () => {
    await cleanEarlyDb();
    await cleanDb();
    const created = await createClinicWithOwner({
      clinicName: EARLY_NAME,
      name: "د. مبكر",
      phone: EARLY_PHONE,
      username: "test-early-owner",
      password: "early-pass-1",
    });
    earlyClinicId = created.clinicId;
  });

  afterAll(cleanEarlyDb);

  it("عيادة نشطة بتجربة قائمة ترفع طلب دفع → PENDING (الدفع من أول يوم)", async () => {
    // العيادة في وسط تجربتها — نشطة وليست منتهية
    const state = await getSubscriptionState(earlyClinicId);
    expect(state?.status).toBe("ACTIVE");
    expect(state?.isTrial).toBe(true);

    const result = await createPaymentRequest(earlyClinicId, {
      plan: "YEARLY",
      transferRef: "TR-EARLY-001",
      amountUsd: SUBSCRIPTION_PLANS.YEARLY.priceUsd,
    });
    expect(result.ok).toBe(true);

    const payment = await prisma.subscriptionPayment.findFirstOrThrow({
      where: { clinicId: earlyClinicId, transferRef: "TR-EARLY-001" },
    });
    expect(payment.status).toBe("PENDING");
  });

  it("التفعيل اليدوي لعيادة منتهية يفتح الوصول فوراً وبلا سجل دفع", async () => {
    // اجعل العيادة منتهية: تجربة انتهت قبل أيام ولا اشتراك
    await prisma.clinic.update({
      where: { id: earlyClinicId },
      data: { trialEndsAt: new Date(Date.now() - 3 * DAY) },
    });
    expect((await getSubscriptionState(earlyClinicId))?.status).toBe("EXPIRED");

    const activated = await activateClinicManually(earlyClinicId, {
      plan: "MONTHLY",
      count: 3,
    });
    expect(activated.ok).toBe(true);

    const state = await getSubscriptionState(earlyClinicId);
    expect(state?.status).toBe("ACTIVE");
    // 3 أشهر = 90 يوماً من لحظة التفعيل
    expect(state!.daysLeft).toBeGreaterThanOrEqual(89);
    expect(state!.daysLeft).toBeLessThanOrEqual(91);
    // التفعيل اليدوي بلا طلب دفع — لا سجلات حوالات جديدة
    const payments = await prisma.subscriptionPayment.findMany({
      where: { clinicId: earlyClinicId },
    });
    expect(payments).toHaveLength(1); // طلب الدفع المبكر فقط من الاختبار السابق
  });

  it("تفعيل يدوي ثانٍ → تمدد تراكمي من نهاية الاشتراك القائم", async () => {
    const before = await prisma.clinic.findUniqueOrThrow({
      where: { id: earlyClinicId },
      select: { subscriptionEndsAt: true },
    });

    const activated = await activateClinicManually(earlyClinicId, {
      plan: "YEARLY",
      count: 1,
    });
    expect(activated.ok).toBe(true);

    const after = await prisma.clinic.findUniqueOrThrow({
      where: { id: earlyClinicId },
      select: { subscriptionEndsAt: true },
    });
    // الاشتراك القائم مستقبلي → يُضاف العام كاملاً إلى نهايته
    expect(after.subscriptionEndsAt!.getTime()).toBe(
      before.subscriptionEndsAt!.getTime() + 365 * DAY,
    );
    expect((await getSubscriptionState(earlyClinicId))?.status).toBe("ACTIVE");
  });

  it("إدخال التفعيل اليدوي — يرفض باقة خاطئة وعدداً غير صحيح", () => {
    expect(parseManualActivationInput({ plan: "WEEKLY", count: 1 }).ok).toBe(
      false,
    );
    expect(parseManualActivationInput({ plan: "MONTHLY", count: 0 }).ok).toBe(
      false,
    );
    expect(parseManualActivationInput({ plan: "MONTHLY", count: 2.5 }).ok).toBe(
      false,
    );
    expect(parseManualActivationInput({ plan: "MONTHLY", count: 999 }).ok).toBe(
      false,
    );
    const ok = parseManualActivationInput({ plan: "YEARLY", count: 2 });
    expect(ok.ok).toBe(true);
  });

  it("عيادة منتهية بلا تفعيل تبقى محجوبة — التمديد لا يعيد السيرفر تلقائياً", async () => {
    // عيادة ثانية منتهية لا نلمسها — تبقى EXPIRED عبر قراءتين متتاليتين
    const expired = await createClinicWithOwner({
      clinicName: "عيادة محجوبة (اختبار)",
      name: "د. محجوب",
      phone: "0955555888",
      username: "test-blocked-owner",
      password: "blocked-pass-1",
    });
    await prisma.clinic.update({
      where: { id: expired.clinicId },
      data: { trialEndsAt: new Date(Date.now() - DAY) },
    });

    expect((await getSubscriptionState(expired.clinicId))?.status).toBe(
      "EXPIRED",
    );
    expect((await getSubscriptionState(expired.clinicId))?.status).toBe(
      "EXPIRED",
    );

    await prisma.user.deleteMany({ where: { clinicId: expired.clinicId } });
    await prisma.clinic.delete({ where: { id: expired.clinicId } });
  });
});

// التمييز في الإدخال — ما يصل من الشبكة مجهول حتى يُتحقق
describe("parsePaymentRequestInput", () => {
  it("يقبل إدخالاً صحيحاً ويقص رقم الحوالة", () => {
    const parsed = parsePaymentRequestInput({
      plan: "MONTHLY",
      transferRef: " 123456 ",
      amountUsd: 15,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.transferRef).toBe("123456");
      expect(parsed.value.amountUsd).toBe(15);
    }
  });

  it("يرفض الأنواع الخاطئة والأرقام غير المالية", () => {
    expect(parsePaymentRequestInput(null).ok).toBe(false);
    expect(
      parsePaymentRequestInput({
        plan: "WEEKLY",
        transferRef: "1",
        amountUsd: 15,
      }).ok,
    ).toBe(false);
    expect(
      parsePaymentRequestInput({
        plan: "MONTHLY",
        transferRef: "",
        amountUsd: 15,
      }).ok,
    ).toBe(false);
    expect(
      parsePaymentRequestInput({
        plan: "MONTHLY",
        transferRef: "1",
        amountUsd: 0,
      }).ok,
    ).toBe(false);
  });
});

// حماية اللوحة — سر المنصة مستقل وجلسته الإدارية بصمة لا سر
describe("حماية لوحة إدارة المنصة", () => {
  const ORIGINAL = process.env.PLATFORM_ADMIN_KEY;

  it("بلا سر مهيأ → كل المفاتيح مرفوضة والجلسة باطلة", () => {
    delete process.env.PLATFORM_ADMIN_KEY;
    expect(verifyPlatformAdminKey("anything")).toBe(false);
    expect(isAdminSession({ get: () => undefined })).toBe(false);
  });

  it("سر خاطئ → رفض، سر صحيح → قبول", () => {
    process.env.PLATFORM_ADMIN_KEY = "platform-secret-123";
    expect(verifyPlatformAdminKey("wrong")).toBe(false);
    expect(verifyPlatformAdminKey("platform-secret-123")).toBe(true);

    const cookies = {
      get: (name: string) => ({ name, value: adminSessionCookieValue() }),
    };
    expect(isAdminSession(cookies)).toBe(true);
    expect(isAdminSession({ get: () => ({ value: "forged" }) })).toBe(false);
  });

  it("بلا كوكي إداري → غير مصادق", () => {
    expect(isAdminSession({ get: () => undefined })).toBe(false);
  });

  afterAll(() => {
    if (ORIGINAL === undefined) delete process.env.PLATFORM_ADMIN_KEY;
    else process.env.PLATFORM_ADMIN_KEY = ORIGINAL;
  });
});

// معيار التحقق 3 — المنع الكامل: فحص مصدري يضمن ألا يوجد مسار API محمي
// نسي البوابة، وألا يوجد layout تطبيق نسي تحويل المنتهين. التحويل و402
// أنفسهما مغطيان بحارس موحّد (requireGate) اختُبر سلوكه في الوحدات.
describe("لا مسار محمي بلا بوابة الاشتراك", () => {
  // مسار الدعم المقصود قبله: قنوات استعادة الملكية للعيادات المقفلة خارجها
  const EXEMPT = [
    "app/api/auth/",
    "app/api/lock/",
    "app/api/subscription/",
    "app/api/admin/",
    "app/api/support/",
  ];

  function walkRoutes(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walkRoutes(full) : [full];
    });
  }

  it("كل route.ts محمي يستدعي requireGate — بلا استثناء منسي", () => {
    const routes = walkRoutes("app/api").filter((file) =>
      file.endsWith("route.ts"),
    );
    expect(routes.length).toBeGreaterThan(10);

    const unguarded = routes.filter((file) => {
      const posix = file.replaceAll(path.sep, "/");
      if (EXEMPT.some((prefix) => posix.includes(prefix))) return false;
      return !fs.readFileSync(file, "utf8").includes("requireGate(");
    });
    expect(unguarded).toEqual([]);
  });

  it("layout التطبيق يحوّل المنتهين إلى /subscription-expired", () => {
    const layout = fs.readFileSync("app/(app)/layout.tsx", "utf8");
    expect(layout).toContain("/subscription-expired");
  });
});
