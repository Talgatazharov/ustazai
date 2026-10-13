import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getAssessment } from '@/lib/assessments/repository';
import AssessmentEditor from '@/features/assessments/AssessmentEditor';
import { getWorkspace } from '@/lib/workspace/repository';

export const dynamic = 'force-dynamic';

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) redirect('/login');
  const { id } = await params;
  const assessment = await getAssessment(user.id, id);
  if (!assessment) notFound();
  const workspace = await getWorkspace(user.id);
  const schoolClass = workspace.classes.find(c => c.id === assessment.classId);
  return (
    <AssessmentEditor
      initial={assessment}
      grade={schoolClass?.name ?? '7А'}
      subject={assessment.subject ?? schoolClass?.subject ?? 'Информатика'}
    />
  );
}
