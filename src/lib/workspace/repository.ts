import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma, useDevStore } from '@/lib/db/client';
import { devWrite, ensureDemoGrading } from '@/lib/db/dev-store';
import type { Assessment, Document, SchoolClass, Student, WorkspaceData } from '@/features/workspace/data';

type Resource = keyof WorkspaceData;
type RecordByResource = { classes:SchoolClass;students:Student;assessments:Assessment;documents:Document };
const kindToDb: Record<string,'BJB'|'TJB'|'FORMATIVE'|'EXAM'>={'БЖБ':'BJB','ТЖБ':'TJB','Қалыптастырушы бағалау':'FORMATIVE','Бақылау жұмысы':'EXAM'};
const kindFromDb: Record<string,Assessment['kind']>={BJB:'БЖБ',TJB:'ТЖБ',FORMATIVE:'Қалыптастырушы бағалау',EXAM:'Бақылау жұмысы'};
const docToDb: Record<string,'LESSON_PLAN'|'ASSESSMENT'|'TEST'|'WORKSHEET'|'ANALYTICS'|'PARENT_REPORT'|'OTHER'>={'ҚМЖ':'LESSON_PLAN','БЖБ':'ASSESSMENT','ТЖБ':'ASSESSMENT','Тест':'TEST','Аналитика':'ANALYTICS'};
const categoryFromDb:Record<string,string>={LESSON_PLAN:'ҚМЖ',ASSESSMENT:'БЖБ',TEST:'Тест',WORKSHEET:'Жұмыс парағы',ANALYTICS:'Аналитика',PARENT_REPORT:'Ата-ана есебі',OTHER:'Басқа'};
const date=(d:Date)=>d.toLocaleDateString('kk-KZ');
function gradeOf(name:string){return Number(name.match(/^\d+/)?.[0]??0);}
function letterOf(name:string){return name.replace(/^\d+/,'').trim();}

export async function getWorkspace(teacherId:string):Promise<WorkspaceData>{
  if(useDevStore)return devWrite(db=>{ensureDemoGrading(db,teacherId);const ws=structuredClone(db.workspaces[teacherId]??{classes:[],students:[],assessments:[],documents:[]});const approved=(db.grading??[]).filter(item=>item.teacherId===teacherId&&item.status==='APPROVED'&&item.maxScore>0);for(const student of ws.students){const own=approved.filter(item=>item.studentId===student.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));const values=own.map(item=>Math.round(100*(item.teacherScore??item.aiScore)/item.maxScore));student.average=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0;student.trend=values.length>1?values.at(-1)!-values.at(-2)!:0;}for(const assessment of ws.assessments){const own=approved.filter(item=>item.assessmentId===assessment.id);assessment.average=own.length?Math.round(own.reduce((sum,item)=>sum+100*(item.teacherScore??item.aiScore)/item.maxScore,0)/own.length):0;}return ws;});
  const [classes,students,assessments,documents]=await Promise.all([
    prisma.class.findMany({where:{teacherId,deletedAt:null},include:{subject:true},orderBy:{name:'asc'}}),
    prisma.student.findMany({where:{teacherId,deletedAt:null,schoolClass:{deletedAt:null}},orderBy:{name:'asc'}}),
    prisma.assessment.findMany({where:{teacherId,deletedAt:null},orderBy:{createdAt:'desc'}}),
    prisma.document.findMany({where:{teacherId,deletedAt:null},orderBy:{createdAt:'desc'}})
  ]);
  return {
    classes:classes.map(c=>({id:c.id,name:c.name,subject:c.subject?.name??'—',room:c.room??'—'})),
    students:students.map(s=>({id:s.id,name:s.name,classId:s.classId,average:0,trend:0})),
    assessments:assessments.map(a=>({id:a.id,title:a.title,classId:a.classId,kind:kindFromDb[a.kind],date:date(a.createdAt),average:0,topic:a.topic??undefined,totalPoints:a.totalPoints})),
    documents:documents.map(d=>({id:d.id,title:d.title,category:categoryFromDb[d.kind],date:date(d.createdAt),storageKey:d.storageKey??undefined,originalName:d.originalName??undefined,mimeType:d.mimeType??undefined,size:d.size??undefined}))
  };
}

export async function createRecord<R extends Resource>(teacherId:string,resource:R,value:Omit<RecordByResource[R],'id'>):Promise<RecordByResource[R]>{
  if(useDevStore)return devWrite(db=>{
    const ws=db.workspaces[teacherId];if(!ws)throw new Error('Жұмыс кеңістігі табылмады.');
    if(resource==='students'&&!ws.classes.some(c=>c.id===(value as Omit<Student, 'id'>).classId))throw new Error('Сынып табылмады.');
    if(resource==='assessments'&&!ws.classes.some(c=>c.id===(value as Omit<Assessment, 'id'>).classId))throw new Error('Сынып табылмады.');
    const record={...value,id:randomUUID()} as RecordByResource[R];
    (ws[resource] as RecordByResource[R][]).push(record);return record;
  });
  if(resource==='classes'){
    const v=value as Omit<SchoolClass, 'id'>;const name=v.name.trim();const subject=await prisma.subject.upsert({where:{name:v.subject},create:{name:v.subject},update:{}});
    const result=await prisma.class.create({data:{teacherId,name,grade:gradeOf(name),letter:letterOf(name),academicYear:'2026–2027',room:v.room,subjectId:subject.id}});
    return {id:result.id,name:result.name,room:result.room??'—',subject:v.subject} as RecordByResource[R];
  }
  if(resource==='students'){
    const v=value as Omit<Student, 'id'>;const schoolClass=await prisma.class.findFirst({where:{id:v.classId,teacherId,deletedAt:null}});if(!schoolClass)throw new Error('Сынып табылмады.');
    const result=await prisma.student.create({data:{teacherId,classId:v.classId,name:v.name.trim()}});
    return {id:result.id,name:result.name,classId:result.classId,average:0,trend:0} as RecordByResource[R];
  }
  if(resource==='assessments'){
    const v=value as Omit<Assessment, 'id'>;const schoolClass=await prisma.class.findFirst({where:{id:v.classId,teacherId,deletedAt:null}});if(!schoolClass)throw new Error('Сынып табылмады.');
    const result=await prisma.assessment.create({data:{teacherId,classId:v.classId,title:v.title.trim(),kind:kindToDb[v.kind]??'BJB'}});
    return {id:result.id,title:result.title,classId:result.classId,kind:v.kind,date:date(result.createdAt),average:0} as RecordByResource[R];
  }
  const v=value as Omit<Document, 'id'>;const result=await prisma.document.create({data:{teacherId,title:v.title.trim(),kind:docToDb[v.category]??'OTHER'}});
  return {id:result.id,title:result.title,category:v.category,date:date(result.createdAt)} as RecordByResource[R];
}

export async function updateRecord<R extends Resource>(teacherId:string,resource:R,id:string,changes:Partial<RecordByResource[R]>){
  if(useDevStore)return devWrite(db=>{const ws=db.workspaces[teacherId];if(!ws)throw new Error('Жұмыс кеңістігі табылмады.');const record=(ws[resource] as RecordByResource[R][]).find(r=>r.id===id);if(!record)throw new Error('Жазба табылмады.');Object.assign(record,changes);return record;});
  if(resource==='classes'){const found=await prisma.class.findFirst({where:{id,teacherId,deletedAt:null}});if(!found)throw new Error('Сынып табылмады.');const v=changes as Partial<SchoolClass>;const result=await prisma.class.update({where:{id},data:{name:v.name,room:v.room,grade:v.name?gradeOf(v.name):undefined,letter:v.name?letterOf(v.name):undefined}});return {id:result.id,name:result.name,subject:'—',room:result.room??'—'};}
  if(resource==='students'){const found=await prisma.student.findFirst({where:{id,teacherId,deletedAt:null}});if(!found)throw new Error('Оқушы табылмады.');const v=changes as Partial<Student>;if(v.classId){const owner=await prisma.class.findFirst({where:{id:v.classId,teacherId,deletedAt:null}});if(!owner)throw new Error('Сынып табылмады.');}return prisma.student.update({where:{id},data:{name:v.name,classId:v.classId}});}
  if(resource==='assessments'){const found=await prisma.assessment.findFirst({where:{id,teacherId,deletedAt:null}});if(!found)throw new Error('Бағалау табылмады.');const v=changes as Partial<Assessment>;return prisma.assessment.update({where:{id},data:{title:v.title,kind:v.kind?kindToDb[v.kind]:undefined}});}
  const found=await prisma.document.findFirst({where:{id,teacherId,deletedAt:null}});if(!found)throw new Error('Құжат табылмады.');const v=changes as Partial<Document>;return prisma.document.update({where:{id},data:{title:v.title,kind:v.category?docToDb[v.category]:undefined}});
}

export async function archiveRecord(teacherId:string,resource:Resource,id:string){
  if(useDevStore)return devWrite(db=>{const ws=db.workspaces[teacherId];if(!ws)throw new Error('Жұмыс кеңістігі табылмады.');const records=ws[resource] as {id:string}[];const index=records.findIndex(r=>r.id===id);if(index<0)throw new Error('Жазба табылмады.');records.splice(index,1);});
  if(resource==='classes'){const result=await prisma.class.updateMany({where:{id,teacherId,deletedAt:null},data:{deletedAt:new Date()}});if(!result.count)throw new Error('Сынып табылмады.');}
  else if(resource==='students'){const result=await prisma.student.updateMany({where:{id,teacherId,deletedAt:null},data:{deletedAt:new Date()}});if(!result.count)throw new Error('Оқушы табылмады.');}
  else if(resource==='assessments'){const result=await prisma.assessment.updateMany({where:{id,teacherId,deletedAt:null},data:{deletedAt:new Date()}});if(!result.count)throw new Error('Бағалау табылмады.');}
  else {const result=await prisma.document.updateMany({where:{id,teacherId,deletedAt:null},data:{deletedAt:new Date()}});if(!result.count)throw new Error('Құжат табылмады.');}
}

export async function importStudents(teacherId:string,classId:string,names:string[]):Promise<Student[]>{
  if(useDevStore)return devWrite(db=>{
    const ws=db.workspaces[teacherId];if(!ws?.classes.some(item=>item.id===classId))throw new Error('Сынып табылмады.');
    const normalize=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('kk');
    const existing=new Set(ws.students.filter(item=>item.classId===classId).map(item=>normalize(item.name)));
    const created:Student[]=[];
    for(const name of names){const key=normalize(name);if(existing.has(key))continue;existing.add(key);const student={id:randomUUID(),name,classId,average:0,trend:0};ws.students.push(student);created.push(student);}
    return created;
  });
  return prisma.$transaction(async tx=>{
    const owner=await tx.class.findFirst({where:{id:classId,teacherId,deletedAt:null}});if(!owner)throw new Error('Сынып табылмады.');
    const existing=await tx.student.findMany({where:{classId,teacherId,deletedAt:null},select:{name:true}});
    const normalize=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('kk');
    const seen=new Set(existing.map(item=>normalize(item.name)));const created:Student[]=[];
    for(const name of names){const key=normalize(name);if(seen.has(key))continue;seen.add(key);const student=await tx.student.create({data:{teacherId,classId,name}});created.push({id:student.id,name:student.name,classId,average:0,trend:0});}
    return created;
  });
}

