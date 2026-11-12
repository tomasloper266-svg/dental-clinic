# نظام إدارة عيادات الأسنان 🦷

نظام SaaS عربي (RTL) لإدارة عيادات الأسنان — كل طبيب يدير عيادته بمساحة معزولة تماماً.

## المكدس التقني

- **Next.js** (App Router) + **TypeScript**
- **Prisma** + **PostgreSQL**
- **Tailwind CSS** — دعم RTL عربي كامل
- **Vitest** + **Testing Library** للاختبارات
- **GitHub Actions** — lint + build + test على كل push

## هيكل المجلدات

```
app/         صفحات وتخطيطات التطبيق (App Router)
components/  مكوّنات واجهة React قابلة لإعادة الاستخدام
lib/         أدوات مشتركة: عميل Prisma (lib/db.ts)، دوال نية (lib/utils.ts)
prisma/      مخطط قاعدة البيانات
tests/       اختبارات Vitest
```

## البدء

```bash
cp .env.example .env    # عدّل DATABASE_URL حسب بيئتك
npm install
npm run dev
```

## الأوامر

| الأمر               | الوظيفة                   |
| ------------------- | ------------------------- |
| `npm run dev`       | خادم التطوير              |
| `npm run build`     | بناء الإنتاج              |
| `npm run lint`      | فحص ESLint                |
| `npm run test`      | تشغيل الاختبارات (Vitest) |
| `npm run format`    | تنسيق الكود بـ Prettier   |
| `npx prisma studio` | واجهة فحص قاعدة البيانات  |

## خطة النسخة الأولى

المرضى · المواعيد مع قائمة انتظار · مخطط أسنان تفاعلي (FDI) بخطة علاج · حسابات المرضى · المصاريف · مخزون المواد مع تنبيه النقص · تذكيرات وتعليمات ما بعد الجراحة برابط واتساب.

> انظر وثيقة المواصفة في مشروع Obvious للتفاصيل الكاملة.
