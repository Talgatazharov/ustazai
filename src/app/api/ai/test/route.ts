import { formatZodError } from '@/features/assessments/schema';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { getAIProvider, getAIRequestConfig } from '@/lib/ai/provider';
export async function POST(request:Request){if(!(await getSession()))return NextResponse.json({error:'Кіру қажет.'},{status:401});try{const provider=getAIProvider(getAIRequestConfig(request));if(provider.mode==='demo')return NextResponse.json({ok:true,mode:'demo',message:'Демо AI режимі қосулы.'});await provider.generateStructured(z.object({ok:z.boolean()}),'connection_test','Тек {"ok":true} мағынасына сәйкес жауап бер.',{ok:true});return NextResponse.json({ok:true,mode:'real',message:'AI сервисіне қосылды.'});}catch(error){return NextResponse.json({error:error instanceof Error?formatZodError(error):'AI сервисін тексеру мүмкін болмады.'},{status:400});}}
