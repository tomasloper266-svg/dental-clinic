import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { scheduleAutoBackup } from "@/lib/services/backup";

// عميل Prisma مفرد — يمنع فتح اتصالات متعددة أثناء hot-reload في التطوير.
// فوقه غلاف استعلام واحد: كل عملية تحديث ناجحة تحمل معرّف عيادة تؤجّل نسخة
// احتياطية تلقائية لتلك العيادة (مجمّعة بمؤقت قصير — انظر lib/services/backup).

/** العمليات المتغيِّرة للبيانات — القراءات لا تستدعي نسخاً احتياطية */
const MUTATION_OPERATIONS = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]);

/** استخراج معرّف العيادة من معاملات العملية — بحث محدود العمق في data/where */
function extractClinicId(value: unknown, depth = 0): string | null {
  if (depth > 3 || value === null || typeof value !== "object") return null;
  for (const [key, child] of Object.entries(value)) {
    if (key === "clinicId" && typeof child === "string") return child;
    if (["data", "where", "create", "update", "connect"].includes(key)) {
      const found = extractClinicId(child, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// العميل الأساسي بلا غلاف — عمليات النسخ الاحتياطي فقط، كي لا تستدعي
// غلاف الاستعلام نفسه فتعيد جدولة نسخة من النسخة.
let baseClient: PrismaClient | undefined;

/** العميل الأساسي — متاح بعد إنشاء العميل الموسّع في تحميل الوحدة */
export function getBasePrisma(): PrismaClient {
  if (!baseClient) {
    throw new Error("Prisma client not initialised");
  }
  return baseClient;
}

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const base = new PrismaClient({ adapter });
  baseClient = base;
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);
          // النسخة نفسها كتابة — تجاهل جدولها كي لا يستدعي نفسه
          if (
            model !== "ClinicBackup" &&
            MUTATION_OPERATIONS.has(operation) &&
            args !== undefined
          ) {
            const clinicId = extractClinicId(args);
            if (clinicId) scheduleAutoBackup(base, clinicId);
          }
          return result;
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>;
};

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
