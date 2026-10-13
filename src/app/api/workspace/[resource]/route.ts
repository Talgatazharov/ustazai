import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { createRecord, updateRecord, archiveRecord } from '@/lib/workspace/repository';
import type { WorkspaceData } from '@/features/workspace/data';
const resourceSchema=z.enum(['classes','students','assessments','documents']);
const schemas={
  classes:z.object({name:z.string().trim().min(2).max(20),subject:z.string().trim().min(2).max(100),room:z.string().trim().max(50)}),
  students:z.object({name:z.string().trim().min(2).max(120),classId:z.string().min(1),average:z.number().min(0).max(100).default(0),trend:z.number().default(0)}),
  assessments:z.object({title:z.string().trim().min(2).max(200),classId:z.string().min(1),kind:z.enum(['БЖБ','ТЖБ','Қалыптастырушы бағалау','Бақылау жұмысы']),date:z.string().default(''),average:z.number().min(0).max(100).default(0)}),
  documents:z.object({title:z.string().trim().min(2).max(200),category:z.string().min(1).max(60),date:z.string().default('')})
};
type Context={params:Promise<{resource:string}>};
async function auth(context:Context){const user=await getSession();const {resource}=await context.params;const parsed=resourceSchema.safeParse(resource);return {user,resource:parsed.success?parsed.data:null};}
export async function POST(request:Request,context:Context){const {user,resource}=await auth(context);if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});if(!resource)return NextResponse.json({error:'Бөлім табылмады.'},{status:404});try{const value=schemas[resource].parse(await request.json());const record=await createRecord(user.id,resource,value as never);return NextResponse.json({record},{status:201});}catch(error){return NextResponse.json({error:error instanceof z.ZodError?'Өрістерді тексеріңіз.':error instanceof Error?error.message:'Сақтау мүмкін болмады.'},{status:400});}}
export async function PATCH(request:Request,context:Context){const {user,resource}=await auth(context);if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});if(!resource)return NextResponse.json({error:'Бөлім табылмады.'},{status:404});try{const body=await request.json();const id=z.string().min(1).parse(body.id);const changes=schemas[resource].partial().parse(body.changes);const record=await updateRecord(user.id,resource,id,changes as never);return NextResponse.json({record});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Өзгерту мүмкін болмады.'},{status:400});}}
export async function DELETE(request:Request,context:Context){const {user,resource}=await auth(context);if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});if(!resource)return NextResponse.json({error:'Бөлім табылмады.'},{status:404});try{const id=z.string().min(1).parse((await request.json()).id);await archiveRecord(user.id,resource as keyof WorkspaceData,id);return NextResponse.json({ok:true});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Мұрағаттау мүмкін болмады.'},{status:400});}}
