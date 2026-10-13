import Workspace from '@/features/workspace/Workspace';
import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
export const dynamic = 'force-dynamic';
export function generateStaticParams() { return ['classes','students','assessments','lesson-plans','documents'].map(section => ({ section })); }
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; if (!['classes','students','assessments','lesson-plans','documents'].includes(section)) notFound(); if (!(await getSession())) redirect('/login'); return <Workspace section={section} />; }
