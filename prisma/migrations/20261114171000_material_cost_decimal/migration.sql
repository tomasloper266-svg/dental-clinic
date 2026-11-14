-- فجوة 7: تكلفة المادة بعشرية ثابتة — من صحيح إلى DECIMAL(12,2).
-- التحويل الآمن: PostgreSQL يرقّي INTEGER إلى NUMERIC بلا فقدان أو تغيير
-- أي قيمة قائمة (كل صحيح يمثل نفسه بالعشرية)، والعمود nullable فلا قيود.
ALTER TABLE "Material" ALTER COLUMN "costSyp" SET DATA TYPE DECIMAL(12, 2);
