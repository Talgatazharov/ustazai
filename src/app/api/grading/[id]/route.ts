import { formatZodError } from '@/features/assessments/schema';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { getGrading, setRecognizedText, overrideScore, approveGrading } from '@/lib/grading/repository';
type Context={params:Promise<{id:string}>};
export async function GET(_request:Request,{params}:Context){const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});const {id}=await params;const record=await getGrading(user.id,id);return record?NextResponse.json({record}):NextResponse.json({error:'Жұмыс табылмады.'},{status:404});}
export async function PATCH(request:Request,{params}:Context){const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});const {id}=await params;try{const data=await request.json();let record;if(data.action==='text'){const text=z.string().trim().min(1).max(50000).parse(data.text);record=await setRecognizedText(user.id,id,text);}else if(data.action==='override'){const body=z.object({questionId:z.string(),score:z.number().int().min(0),reason:z.string().trim().min(2).max(500)}).parse(data);record=await overrideScore(user.id,id,body.questionId,body.score,body.reason);}else if(data.action==='approve'){record=await approveGrading(user.id,id);}else throw new Error('Әрекет танылмады.');return NextResponse.json({record});}catch(error){return NextResponse.json({error:error instanceof Error?formatZodError(error):'Өңдеу мүмкін болмады.'},{status:400});}}
