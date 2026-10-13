import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { analyzeTemplate } from '@/lib/documents/lesson-template';
export async function GET(){const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});try{return NextResponse.json(await analyzeTemplate());}catch{return NextResponse.json({error:'ҚМЖ үлгісі табылмады.'},{status:503});}}
