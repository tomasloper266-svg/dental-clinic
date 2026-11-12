import { cookies } from "next/headers";
import { pageWrapClass } from "@/lib/page-width";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, getSessionUser } from "@/lib/auth/session";
import InstructionTemplatesBoard from "@/components/instructions/InstructionTemplatesBoard";

// صفحة تعليمات ما بعد العلاج — إدارة القوالب حسب الإجراء، محمية
// بالجلسة وبياناتها من واجهة العيادة حصراً.
export default async function InstructionsPage() {
  const session = await getSessionUser(
    (await cookies()).get(SESSION_COOKIE)?.value,
  );
  if (!session) redirect("/login");

  return (
    <div className={pageWrapClass("wide")}>
      <InstructionTemplatesBoard />
    </div>
  );
}
