import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getAssessment, saveAssessmentDraft } from '@/lib/assessments/repository';
import { formatZodError } from '@/features/assessments/schema';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Кіру қажет.' }, { status: 401 });
  const { id } = await params;
  const assessment = await getAssessment(user.id, id);
  return assessment
    ? NextResponse.json({ assessment })
    : NextResponse.json({ error: 'Бағалау табылмады.' }, { status: 404 });
}

export async function PUT(request: Request, { params }: Context) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Кіру қажет.' }, { status: 401 });
  const { id } = await params;
  try {
    const assessment = await saveAssessmentDraft(user.id, id, await request.json());
    return NextResponse.json({ assessment });
  } catch (error) {
    return NextResponse.json({ error: formatZodError(error) }, { status: 400 });
  }
}
