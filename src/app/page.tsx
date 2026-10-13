import Workspace from '@/features/workspace/Workspace';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getOnboarding } from '@/lib/onboarding/service';
export default async function Home() { const user=await getSession();if (!user) redirect('/login');if(!(await getOnboarding(user.id)).done)redirect('/onboarding');return <Workspace />; }
