// تحضير اسم الطبيب للعرض — بادئة «د. » تُضاف مرة واحدة حصراً. أسماء الطاقم قد
// تحمل البادئة أصلاً من الإدخال، وإضافتها ثانية تُنتج «د. د. خالد المنصور».
export function doctorDisplayName(name: string): string {
  const stripped = name.trim().replace(/^د\.\s*/, "");
  return `د. ${stripped}`;
}
