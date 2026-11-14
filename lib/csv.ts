// بناء CSV نقياً — تنسيق موحّد للتصدير من الجداول (الدفتر المالي وغيره).
// اقتباس كل الخلايا وأسطر CRLF، والتُراج للعربية (BOM) يُلحق عند التنزيل.

/** دالة نقية — تحويل رأس وأسطر إلى نص CSV باقتباس كامل وأسطر CRLF */
export function toCsv(
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
): string {
  const cell = (value: string | number | null | undefined): string =>
    `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
  const lines = [headers.map(cell).join(",")];
  for (const row of rows) {
    lines.push(row.map(cell).join(","));
  }
  return lines.join("\r\n");
}

/** يلحق علامة ترميز UTF-8 لتبديد العربية في Excel — للتنزيل فقط */
export function withUtf8Bom(csv: string): string {
  return `\uFEFF${csv}`;
}

/** تنزيل نص CSV من المتصفح — إلحاق BOM ليُقرأ العربية في Excel */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([withUtf8Bom(csv)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
