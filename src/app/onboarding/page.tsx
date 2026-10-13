import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import Onboarding from '@/features/onboarding/Onboarding';
export const dynamic='force-dynamic';
export default async function OnboardingPage(){const user=await getSession();if(!user)redirect('/login');return <Onboarding name={user.name}/>;}
