import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { generateLessonDocx } from '@/lib/documents/lesson-template';
import { savePrivateFile } from '@/lib/storage/local';
import { createStoredDocument } from '@/lib/documents/repository';
import { formatZodError } from '@/features/assessments/schema';
export async function POST(request:Request){const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});try{const content=await request.json();const result=await generateLessonDocx(content);const filename=`ҚМЖ-${String(content.grade||'сынып')}-${String(content.date||'күн')}.docx`;const metadata=await savePrivateFile(user.id,filename,result.buffer);await createStoredDocument(user.id,{title:`ҚМЖ — ${String(content.topic||'Сабақ')}`,category:'ҚМЖ',...metadata});return new NextResponse(new Uint8Array(result.buffer),{headers:{'content-type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,'x-template-validated':'true'}});}catch(error){return NextResponse.json({error:formatZodError(error)},{status:400});}}
