import { NextResponse } from 'next/server';
import { z } from 'zod';
import { login } from '@/lib/auth/users';
import { createSession } from '@/lib/auth/session';
const schema=z.object({email:z.email(),password:z.string().min(1)});
export async function POST(request:Request){try{const data=schema.parse(await request.json());const user=await login(data.email,data.password);if(!user)return NextResponse.json({error:'Email немесе құпиясөз қате.'},{status:401});await createSession(user);return NextResponse.json({user});}catch{return NextResponse.json({error:'Деректерді тексеріңіз.'},{status:400});}}
