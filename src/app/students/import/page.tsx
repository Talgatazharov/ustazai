import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import StudentImport from '@/features/students/StudentImport';
export const dynamic='force-dynamic';
export default async function StudentImportPage(){if(!(await getSession()))redirect('/login');return <StudentImport/>;}
