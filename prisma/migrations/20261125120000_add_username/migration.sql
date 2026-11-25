-- معرف الدخول (Username) — فريد عالمياً، اختياري للمستخدمين القدامى (يدخلون بالهاتف).
ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
