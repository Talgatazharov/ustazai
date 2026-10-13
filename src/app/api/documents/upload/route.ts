import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { savePrivateFile } from '@/lib/storage/local';
import { createStoredDocument } from '@/lib/documents/repository';
export async function POST(request:Request){const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});try{const form=await request.formData();const file=form.get('file');const category=String(form.get('category')||'Басқа');if(!(file instanceof File))throw new Error('Файл таңдалмады.');const metadata=await savePrivateFile(user.id,file.name,Buffer.from(await file.arrayBuffer()));const document=await createStoredDocument(user.id,{title:file.name,category,...metadata});return NextResponse.json({document},{status:201});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Файл жүктелмеді.'},{status:400});}}
