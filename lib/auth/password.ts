import bcrypt from "bcryptjs";

// 12 دورة — توازن معقول بين الأمان وزمن الاستجابة على VPS واحد.
const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
