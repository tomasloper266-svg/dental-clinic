import { redirect } from "next/navigation";

// الصفحة القديمة /finance صارت /invoices — إعادة توجيه تحفظ روابط العيادة القديمة.
export default function FinancePage() {
  redirect("/invoices");
}
