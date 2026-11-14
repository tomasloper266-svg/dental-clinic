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

// نماذج بلا عمود clinicId — عزلها عبر علاقتها بالأب المحصور حصراً. كل قراءة
// مباشرة عليها تُفلتر بـ clinicId الأب، وإنشاؤها متداخل تحت الأب دائماً
// فيحمل نطاق العيادة من قيد الأب نفسه.
const TRANSITIVE_CHILD_SCOPES: Record<string, { parent: string; field: string }> = {
  // بنود الفاتورة أبناء قيد رسوم — عزلها عبر entry.clinicId
  LedgerEntryItem: { parent: "entry", field: "clinicId" },
};

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

/**
 * حقن نطاق العيادة لنموذج ابن بلا عمود clinicId — عبر علاقة الأب، للقراءة
 * فقط. فلاتر علاقة الأب القادمة من المستدعي تُدمج مع فلتر العيادة لا تستبدل.
 * الكتابة المباشرة على نموذج ابن غير مساندة (تُنشأ متداخلة تحت الأب دائماً).
 */
function injectChildScope(
  operation: string,
  args: RawArgs,
  parent: string,
  clinicId: string,
): RawArgs {
  if (!WHERE_OPERATIONS.has(operation)) return args;
  const next = { ...args };
  const where = (next.where ?? {}) as RawArgs;
  const relation = (where[parent] ?? {}) as RawArgs;
  next.where = { ...where, [parent]: { ...relation, clinicId } };
  return next;
}

// العميل المُرجع يوفّر نفس نماذج Prisma لكن كل عملية عليه محصورة بالعيادة.
export function clinicScope(clinicId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const childScope = TRANSITIVE_CHILD_SCOPES[model ?? ""];
          const scoped = childScope
            ? injectChildScope(
                operation,
                (args ?? {}) as RawArgs,
                childScope.parent,
                clinicId,
              )
            : injectClinicId(operation, (args ?? {}) as RawArgs, clinicId);
          return query(scoped as typeof args);
        },
      },
    },
  });
}

export type ClinicClient = ReturnType<typeof clinicScope>;
