import { NextResponse } from 'next/server';
import { z } from 'zod';
import { register } from '@/lib/auth/users';
import { createSession } from '@/lib/auth/session';
const schema=z.object({name:z.string().trim().min(2).max(120),email:z.email(),password:z.string().min(10).max(128)});
export async function POST(request:Request){try{const data=schema.parse(await request.json());const user=await register(data.name,data.email,data.password);await createSession(user);return NextResponse.json({user},{status:201});}catch(error){return NextResponse.json({error:error instanceof z.ZodError?'Деректерді тексеріңіз.':error instanceof Error?error.message:'Тіркелу мүмкін болмады.'},{status:400});}}
