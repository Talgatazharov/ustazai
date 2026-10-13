import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import AISettings from '@/features/settings/AISettings';
export const dynamic='force-dynamic';
export default async function SettingsPage(){if(!(await getSession()))redirect('/login');return <AISettings/>;}
