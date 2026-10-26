import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

const BCRYPT_ROUNDS = 10;
// Compared against when the user does not exist, to keep login timing uniform.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export const hashPassword = (plain: string) => bcrypt.hash(plain, BCRYPT_ROUNDS);

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH).then((ok) => ok && !!hash);
}

export interface TokenPayload {
  sub: string;
  tenant_id: string | null;
}

export function signToken(userId: string, tenantId: string | null): string {
  const options: SignOptions = {
    subject: userId,
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
    algorithm: 'HS256',
  };
  return jwt.sign({ tenant_id: tenantId }, env.jwtSecret, options);
}

export function verifyToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  if (typeof decoded === 'string' || !decoded.sub) {
    throw new Error('Invalid token payload');
  }
  return { sub: decoded.sub, tenant_id: (decoded as jwt.JwtPayload).tenant_id ?? null };
}

export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
export const randomId = () => crypto.randomUUID();

export function generateTempPassword(): string {
  // Guarantees upper, lower, digit and symbol so it satisfies the password policy.
  return `${crypto.randomBytes(6).toString('base64url')}aA1!`;
}
