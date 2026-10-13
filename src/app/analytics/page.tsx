import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import AnalyticsPageClient from '@/features/analytics/AnalyticsPageClient';
export const dynamic='force-dynamic';
export default async function AnalyticsPage(){if(!(await getSession()))redirect('/login');return <AnalyticsPageClient/>;}
