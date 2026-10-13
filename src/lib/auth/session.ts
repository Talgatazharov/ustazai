import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma, useDevStore } from '@/lib/db/client';
import { devRead } from '@/lib/db/dev-store';

const cookieName = 'ustaz_session';
async function key() {
  let value = process.env.AUTH_SECRET || '';
  if (!value && process.env.NODE_ENV !== 'production') {
    const file = path.join(process.cwd(), '.data', 'auth-secret');
    try { value = await fs.readFile(file, 'utf8'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await fs.mkdir(path.dirname(file), { recursive: true });
      try { await fs.writeFile(file, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
      catch (writeError) { if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') throw writeError; }
      value = await fs.readFile(file, 'utf8');
    }
  }
  if (value.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters');
  return new TextEncoder().encode(value);
}
export type SessionUser = { id: string; email: string; name: string; role: 'TEACHER'|'ADMIN'|'STUDENT' };
export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ email:user.email, name:user.name, role:user.role }).setProtectedHeader({ alg:'HS256' }).setSubject(user.id).setIssuedAt().setExpirationTime('7d').sign(await key());
  (await cookies()).set(cookieName, token, { httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'lax', path:'/', maxAge:60*60*24*7 });
}
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, await key()); if (!payload.sub || !payload.email || !payload.name || !['TEACHER','ADMIN','STUDENT'].includes(String(payload.role))) return null;const user=useDevStore?await devRead(db=>db.users.find(u=>u.id===payload.sub)):await prisma.user.findFirst({where:{id:payload.sub,deletedAt:null}});if(!user||user.role!=='TEACHER')return null;return { id:user.id, email:user.email, name:user.name, role:user.role }; }
  catch { return null; }
}
export async function clearSession() { (await cookies()).delete(cookieName); }
