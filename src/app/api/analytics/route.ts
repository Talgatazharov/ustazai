import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getWorkspace } from '@/lib/workspace/repository';
import { listGrading } from '@/lib/grading/repository';
import { calculateAnalytics } from '@/features/analytics/calculate';
export async function GET(request:Request){const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});const classId=new URL(request.url).searchParams.get('classId')||undefined;const [workspace,records]=await Promise.all([getWorkspace(user.id),listGrading(user.id)]);if(classId&&!workspace.classes.some(c=>c.id===classId))return NextResponse.json({error:'Сынып табылмады.'},{status:404});return NextResponse.json({analytics:calculateAnalytics(workspace,records,classId)});}
