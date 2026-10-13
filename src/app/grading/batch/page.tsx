import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import BatchWorkspace from '@/features/grading/BatchWorkspace';
export const dynamic='force-dynamic';
export default async function BatchPage(){if(!(await getSession()))redirect('/login');return <BatchWorkspace/>;}
