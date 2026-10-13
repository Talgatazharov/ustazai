import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import GradingWorkspace from '@/features/grading/GradingWorkspace';
export const dynamic='force-dynamic';
export default async function GradingPage(){if(!(await getSession()))redirect('/login');return <GradingWorkspace/>;}
