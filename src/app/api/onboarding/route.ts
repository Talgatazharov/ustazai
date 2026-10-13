import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getOnboarding, completeOnboarding } from '@/lib/onboarding/service';
export async function GET(){const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});return NextResponse.json(await getOnboarding(user.id));}
export async function POST(request:Request){const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});try{return NextResponse.json(await completeOnboarding(user.id,await request.json()));}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Деректерді сақтауға болмады.'},{status:400});}}
