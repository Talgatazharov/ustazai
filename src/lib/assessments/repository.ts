import 'server-only';
import { prisma, useDevStore } from '@/lib/db/client';
import { devRead, devWrite } from '@/lib/db/dev-store';
import { assessmentDraftSchema, validateAssessment, formatZodError } from '@/features/assessments/schema';
import type { Assessment } from '@/features/workspace/data';

export async function getAssessment(teacherId:string,id:string):Promise<Assessment|null>{
  if(useDevStore)return devRead(db=>db.workspaces[teacherId]?.assessments.find(a=>a.id===id)??null);
  const result=await prisma.assessment.findFirst({where:{id,teacherId,deletedAt:null},include:{questions:{orderBy:{position:'asc'},include:{criterion:{include:{descriptors:true}}}}}});
  if(!result)return null;
  return {id:result.id,title:result.title,classId:result.classId,kind:result.kind==='TJB'?'ТЖБ':'БЖБ',date:result.createdAt.toLocaleDateString('kk-KZ'),average:0,quarter:result.quarter??undefined,unit:result.unit??undefined,topic:result.topic??undefined,objectives:result.objectives,durationMinutes:result.durationMinutes??undefined,difficulty:result.difficulty??undefined,totalPoints:result.totalPoints,questions:result.questions.map(q=>({id:q.id,type:q.type as NonNullable<Assessment['questions']>[number]['type'],question:q.question,answer:q.answer,points:q.points,criterion:q.criterion?.text??'',descriptors:q.criterion?.descriptors.map(d=>({text:d.text,points:d.points}))??[]}))};
}
export async function saveAssessmentDraft(teacherId:string,id:string,input:unknown){
  const parsed = assessmentDraftSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }
  const draft = parsed.data;
  const validation = validateAssessment(draft);
  if (validation.issues.length) throw new Error(validation.issues.join(' '));
  if(useDevStore)return devWrite(db=>{const assessment=db.workspaces[teacherId]?.assessments.find(a=>a.id===id);if(!assessment)throw new Error('Бағалау табылмады.');if(db.grading?.some(record=>record.assessmentId===id))throw new Error('Жұмыс тапсырылған бағалаудың сұрақтарын өзгертуге болмайды. Жаңа бағалау жасаңыз.');Object.assign(assessment,{...draft,totalPoints:validation.totalPoints});return assessment;});
  const assessment=await prisma.assessment.findFirst({where:{id,teacherId,deletedAt:null}});if(!assessment)throw new Error('Бағалау табылмады.');
  await prisma.$transaction(async tx=>{const submitted=await tx.submission.count({where:{assessmentId:id}});if(submitted)throw new Error('Жұмыс тапсырылған бағалаудың сұрақтарын өзгертуге болмайды. Жаңа бағалау жасаңыз.');await tx.assessmentQuestion.deleteMany({where:{assessmentId:id}});await tx.assessment.update({where:{id},data:{title:draft.title,quarter:draft.quarter,unit:draft.unit,topic:draft.topic,objectives:draft.objectives,durationMinutes:draft.durationMinutes,difficulty:draft.difficulty,totalPoints:validation.totalPoints,status:'DRAFT'}});for(let i=0;i<draft.questions.length;i++){const q=draft.questions[i];await tx.assessmentQuestion.create({data:{assessmentId:id,position:i+1,type:q.type,question:q.question,answer:q.answer,points:q.points,criterion:{create:{text:q.criterion,descriptors:{create:q.descriptors}}}}});}});
  return getAssessment(teacherId,id);
}
