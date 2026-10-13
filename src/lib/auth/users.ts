import 'server-only';
import { randomUUID } from 'node:crypto';
import { hash, compare } from 'bcryptjs';
import { prisma, useDevStore } from '@/lib/db/client';
import { devRead, devWrite, newDemoGrading, newWorkspace } from '@/lib/db/dev-store';
import type { SessionUser } from './session';

export async function register(name: string, email: string, password: string): Promise<SessionUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hash(password, 12);
  if (useDevStore) return devWrite(db => {
    if (db.users.some(u=>u.email===normalizedEmail)) throw new Error('Бұл email бұрын тіркелген.');
    const user = { id:randomUUID(), name:name.trim(), email:normalizedEmail, passwordHash, role:'TEACHER' as const, onboardingDone:false };
    db.users.push(user); db.workspaces[user.id] = newWorkspace();db.grading=[...(db.grading??[]),...newDemoGrading(user.id)];
    return { id:user.id, name:user.name, email:user.email, role:user.role };
  });
  const existing=await prisma.user.findUnique({where:{email:normalizedEmail}}); if(existing) throw new Error('Бұл email бұрын тіркелген.');
  const user=await prisma.user.create({data:{name:name.trim(),email:normalizedEmail,passwordHash,role:'TEACHER',profile:{create:{}}}});
  return {id:user.id,name:user.name,email:user.email,role:user.role};
}
export async function login(email:string,password:string): Promise<SessionUser | null> {
  const normalizedEmail=email.trim().toLowerCase();
  const user=useDevStore ? await devRead(db=>db.users.find(u=>u.email===normalizedEmail)) : await prisma.user.findUnique({where:{email:normalizedEmail}});
  if(!user || !(await compare(password,user.passwordHash))) return null;
  return {id:user.id,name:user.name,email:user.email,role:user.role};
}
