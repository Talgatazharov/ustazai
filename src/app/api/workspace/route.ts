import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getWorkspace } from '@/lib/workspace/repository';
import { useDevStore } from '@/lib/db/client';
export async function GET(){const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});try{return NextResponse.json({data:await getWorkspace(user.id),user,demoMode:useDevStore});}catch{return NextResponse.json({error:'Деректерді жүктеу мүмкін болмады.'},{status:500});}}
