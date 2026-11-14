import { redirect } from "next/navigation";

// صفحة قديمة أصبحت تحويلة — مخطط الأسنان المستقل انتقل إلى /dental،
// والمعاملات (patient وtooth) تُحفظ كما هي لأي روابط محفوظة.

export default async function ChartPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string; tooth?: string }>;
}) {
  const { patient, tooth } = await searchParams;
  const params = new URLSearchParams();
  if (patient) params.set("patient", patient);
  if (tooth) params.set("tooth", tooth);
  const query = params.toString();
  redirect(query ? `/dental?${query}` : "/dental");
}
