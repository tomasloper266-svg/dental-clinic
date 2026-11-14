import { redirect } from "next/navigation";

// دمج المخطط وخطط العلاج في مسار واحد (/chart) — إعادة توجيه دائمة تحافظ
// على مريض الرابط القديم حتى لا تنكسر الروابط المحفوظة.
export default async function PlansRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ patient?: string }>;
}) {
  const { patient } = await searchParams;
  redirect(patient ? `/dental?patient=${encodeURIComponent(patient)}` : "/dental");
}
