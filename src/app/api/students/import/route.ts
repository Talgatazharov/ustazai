import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getWorkspace, importStudents } from '@/lib/workspace/repository';
import { parseStudentFile, previewStudentNames } from '@/lib/students/import';

async function handle(request:Request,commit:boolean){
  const user=await getSession();if(!user)return NextResponse.json({error:'Кіру қажет.'},{status:401});
  try{
    const form=await request.formData();const file=form.get('file');const classId=String(form.get('classId')??'');
    if(!(file instanceof File))throw new Error('Файл таңдалмады.');if(file.size>5*1024*1024)throw new Error('Файл 5 МБ-тан аспауы тиіс.');
    const workspace=await getWorkspace(user.id);if(!workspace.classes.some(item=>item.id===classId))throw new Error('Сынып табылмады.');
    const names=await parseStudentFile(file.name,Buffer.from(await file.arrayBuffer()));
    if(names.length>1000)throw new Error('Бір импортта 1000 жолдан аспауы тиіс.');
    const rows=previewStudentNames(names,workspace.students.filter(item=>item.classId===classId).map(item=>item.name));
    if(!commit)return NextResponse.json({rows,ready:rows.filter(row=>row.status==='ready').length});
    const created=await importStudents(user.id,classId,rows.filter(row=>row.status==='ready').map(row=>row.name));
    return NextResponse.json({created:created.length,rows});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Импорттау мүмкін болмады.'},{status:400});}
}
export async function POST(request:Request){return handle(request,false);}
export async function PUT(request:Request){return handle(request,true);}
