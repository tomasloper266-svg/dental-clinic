import { cookies } from "next/headers";
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <InstructionTemplatesBoard />
    </div>
  );
}
