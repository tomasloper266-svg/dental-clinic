// بيانات عرض قوالب التعليمات — نقية بلا I/O.

export type TemplateFields = {
  id: string;
  procedure: string;
  body: string;
};

/** نقية — تصفية القوالب بمطابقة الإجراء أو النص، وكل الأقسام بلا بحث */
export function filterTemplates<T extends TemplateFields>(
  templates: readonly T[],
  needle: string,
): T[] {
  const query = needle.trim().toLowerCase();
  if (!query) return [...templates];
  return templates.filter(
    (t) =>
      t.procedure.toLowerCase().includes(query) ||
      t.body.toLowerCase().includes(query),
  );
}

/** نقية — سطر المعاينة القصير في بطاقة القالب: أول سطر من النص */
export function templateExcerpt(body: string, max = 64): string {
  const line = body.trim().split("\n")[0] ?? "";
  return line.length > max ? `${line.slice(0, max)}…` : line;
}
