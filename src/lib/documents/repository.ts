import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma, useDevStore } from '@/lib/db/client';
import { devRead, devWrite } from '@/lib/db/dev-store';
import type { Document } from '@/features/workspace/data';

const docToDb:Record<string,'LESSON_PLAN'|'ASSESSMENT'|'TEST'|'WORKSHEET'|'ANALYTICS'|'PARENT_REPORT'|'OTHER'>={'ҚМЖ':'LESSON_PLAN','БЖБ':'ASSESSMENT','ТЖБ':'ASSESSMENT','Тест':'TEST','Жұмыс парағы':'WORKSHEET','Аналитика':'ANALYTICS','Ата-ана есебі':'PARENT_REPORT'};
export async function createStoredDocument(teacherId:string,input:Omit<Document,'id'|'date'>){
  if(useDevStore)return devWrite(db=>{const ws=db.workspaces[teacherId];if(!ws)throw new Error('Жұмыс кеңістігі табылмады.');const doc={...input,id:randomUUID(),date:new Date().toLocaleDateString('kk-KZ')};ws.documents.push(doc);return doc;});
  const result=await prisma.document.create({data:{teacherId,title:input.title,kind:docToDb[input.category]??'OTHER',storageKey:input.storageKey,originalName:input.originalName,mimeType:input.mimeType,size:input.size}});
  return {id:result.id,title:result.title,category:input.category,date:result.createdAt.toLocaleDateString('kk-KZ')};
}
export async function getStoredDocument(teacherId:string,id:string){
  if(useDevStore)return devRead(db=>db.workspaces[teacherId]?.documents.find(d=>d.id===id));
  const doc=await prisma.document.findFirst({where:{id,teacherId,deletedAt:null}});return doc?{id:doc.id,title:doc.title,category:Object.keys(docToDb).find(key=>docToDb[key]===doc.kind)||'Басқа',storageKey:doc.storageKey??undefined,originalName:doc.originalName??undefined,mimeType:doc.mimeType??undefined,size:doc.size??undefined}:undefined;
}
