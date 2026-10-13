import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getStoredDocument, createStoredDocument } from '@/lib/documents/repository';
export async function POST(_request:Request,{params}:{params:Promise<{id:string}>}){const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});const {id}=await params;const source=await getStoredDocument(user.id,id);if(!source)return NextResponse.json({error:'Құжат табылмады.'},{status:404});const document=await createStoredDocument(user.id,{title:`${source.title} (көшірме)`,category:source.category||'Басқа',storageKey:source.storageKey,originalName:source.originalName,mimeType:source.mimeType,size:source.size});return NextResponse.json({document},{status:201});}
