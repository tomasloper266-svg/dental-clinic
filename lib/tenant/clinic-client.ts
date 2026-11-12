import { prisma } from "@/lib/db";

// العميل المحصور بالعيادة — الطبقة الوحيدة المسموحة للاستعلام عن بيانات العيادة.
// عبر $extensions يُحقن clinicId إجبارياً في كل عملية: `where` للقراءة والتحديث
// والحذف، و`data` للإنشاء — فيصعب نسيان الفلتر مهما كتب المستدعي.
// الكتابات المتداخلة (nested writes) غير مدعومة عبر هذه الطبقة — تُنفّذ في
// المستوى الأعلى فقط لضمان حقن clinicId في كل نموذج مُلموس.

type RawArgs = Record<string, unknown>;

const WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

const CREATE_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
]);

function injectClinicId(
  operation: string,
  args: RawArgs,
  clinicId: string,
): RawArgs {
  const next = { ...args };

  if (WHERE_OPERATIONS.has(operation)) {
    const where = (next.where ?? {}) as RawArgs;
    next.where = { ...where, clinicId };
  } else if (operation === "upsert") {
    const where = (next.where ?? {}) as RawArgs;
    next.where = { ...where, clinicId };
    const create = (next.create ?? {}) as RawArgs;
    next.create = { ...create, clinicId };
  } else if (CREATE_OPERATIONS.has(operation)) {
    if (Array.isArray(next.data)) {
      next.data = next.data.map((row) => ({ ...(row as RawArgs), clinicId }));
    } else {
      const data = (next.data ?? {}) as RawArgs;
      next.data = { ...data, clinicId };
    }
  }

  return next;
}

// العميل المُرجع يوفّر نفس نماذج Prisma لكن كل عملية عليه محصورة بالعيادة.
export function clinicScope(clinicId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          const scoped = injectClinicId(
            operation,
            (args ?? {}) as RawArgs,
            clinicId,
          );
          return query(scoped as typeof args);
        },
      },
    },
  });
}

export type ClinicClient = ReturnType<typeof clinicScope>;
