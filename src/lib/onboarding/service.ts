import 'server-only';
import { z } from 'zod';
import { prisma, useDevStore } from '@/lib/db/client';
import { devRead, devWrite } from '@/lib/db/dev-store';
import { createRecord, getWorkspace } from '@/lib/workspace/repository';
export const onboardingSchema=z.object({name:z.string().trim().min(2).max(120),school:z.string().trim().min(2).max(160),subject:z.string().trim().min(2).max(100),classes:z.array(z.string().trim().min(2).max(20)).min(1),template:z.enum(['canonical','later']),aiMode:z.enum(['mock','configured'])});
export async function getOnboarding(userId:string){if(useDevStore)return devRead(db=>{const user=db.users.find(u=>u.id===userId);return {done:user?.onboardingDone??false,name:user?.name??'',school:user?.school??'',subject:user?.subject??''};});const user=await prisma.user.findUnique({where:{id:userId},include:{profile:true}});return {done:user?.profile?.onboardingDone??false,name:user?.name??'',school:user?.profile?.school??'',subject:user?.profile?.subject??''};}
export async function completeOnboarding(userId:string,input:unknown){const value=onboardingSchema.parse(input);const existing=await getWorkspace(userId);for(const name of [...new Set(value.classes)]){if(!existing.classes.some(c=>c.name.toLocaleLowerCase('kk')===name.toLocaleLowerCase('kk')))await createRecord(userId,'classes',{name,subject:value.subject,room:'—'});}
  if(useDevStore)return devWrite(db=>{const user=db.users.find(u=>u.id===userId);if(!user)throw new Error('Пайдаланушы табылмады.');Object.assign(user,{name:value.name,school:value.school,subject:value.subject,onboardingDone:true});return {done:true};});
  await prisma.user.update({where:{id:userId},data:{name:value.name,profile:{upsert:{create:{school:value.school,subject:value.subject,onboardingDone:true,settings:{template:value.template,aiMode:value.aiMode}},update:{school:value.school,subject:value.subject,onboardingDone:true,settings:{template:value.template,aiMode:value.aiMode}}}}}});return {done:true};
}
