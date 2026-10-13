import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createGrading, listGrading } from '@/lib/grading/repository';
import { getOCRRequestConfig } from '@/lib/ocr/provider';
import { getAIRequestConfig } from '@/lib/ai/provider';
export async function GET(){const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});return NextResponse.json({records:await listGrading(user.id)});}
export async function POST(request:Request){const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});try{const ocrConfig=getOCRRequestConfig(request);const aiConfig=getAIRequestConfig(request);const form=await request.formData();const file=form.get('file');if(!(file instanceof File))throw new Error('Файл таңдаңыз.');const record=await createGrading(user.id,String(form.get('assessmentId')||''),String(form.get('studentId')||''),file,ocrConfig,aiConfig);return NextResponse.json({record},{status:201});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Жұмысты өңдеу мүмкін болмады.'},{status:400});}}
