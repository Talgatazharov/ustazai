import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getStoredDocument } from '@/lib/documents/repository';
import { readPrivateFile } from '@/lib/storage/local';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});const {id}=await params;const doc=await getStoredDocument(user.id,id);if(!doc?.storageKey)return NextResponse.json({error:'Құжат файлы табылмады.'},{status:404});try{const bytes=await readPrivateFile(user.id,doc.storageKey);return new NextResponse(new Uint8Array(bytes),{headers:{'content-type':doc.mimeType||'application/octet-stream','content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(doc.originalName||'document')}`,'cache-control':'private, no-store'}});}catch{return NextResponse.json({error:'Файлды оқу мүмкін болмады.'},{status:404});}}
