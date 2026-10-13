import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getGrading } from '@/lib/grading/repository';
import { readPrivateFile } from '@/lib/storage/local';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});const {id}=await params;const record=await getGrading(user.id,id);if(!record)return NextResponse.json({error:'Жұмыс табылмады.'},{status:404});const bytes=await readPrivateFile(user.id,record.storageKey);return new NextResponse(new Uint8Array(bytes),{headers:{'content-type':record.mimeType,'content-disposition':`inline; filename*=UTF-8''${encodeURIComponent(record.originalName)}`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});}
