import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { getAIProvider, getAIRequestConfig, recordAIRequest } from '@/lib/ai/provider';
import { formatZodError } from '@/features/assessments/schema';

const aiAssessmentInputSchema = z
  .object({
    title: z.string().trim().min(2, 'Атауы кемінде 2 таңбадан тұруы керек').optional(),
    subject: z.string().trim().optional(),
    grade: z.string().trim().min(1, 'Сыныпты көрсетіңіз').optional().default('7-сынып'),
    quarter: z.coerce.number().int().min(1).max(4).optional().default(1),
    section: z.string().trim().optional(),
    unit: z.string().trim().optional(),
    topic: z.string().trim().min(2, 'Тақырыпты енгізіңіз (кемінде 2 таңба)'),
    objectives: z.array(z.string().trim()).optional(),
    learningObjectives: z.array(z.string().trim()).optional(),
    criteria: z.array(z.string().trim()).optional().default([]),
    count: z.coerce.number().int().min(1, 'Тапсырма саны кемінде 1 болуы керек').max(20, 'Тапсырма саны 20-дан аспауы керек').default(3),
    totalPoints: z.coerce.number().int().min(1, 'Жалпы балл кемінде 1 болуы керек').max(100, 'Жалпы балл 100-ден аспауы керек').default(20),
    difficulty: z.enum(['Жеңіл', 'Орташа', 'Күрделі']).optional().default('Орташа'),
    durationMinutes: z.coerce.number().int().min(1).max(240).optional().default(40),
    duration: z.coerce.number().int().min(1).max(240).optional(),
  })
  .transform((data) => {
    const rawUnit = data.unit?.trim() || data.section?.trim() || '';
    const rawObjectives = data.objectives?.length
      ? data.objectives
      : (data.learningObjectives?.length ? data.learningObjectives : []);
    const objectives = rawObjectives.map(o => o.trim()).filter(Boolean);
    const durationMinutes = data.durationMinutes ?? data.duration ?? 40;
    return {
      title: data.title?.trim() || `${data.topic} — бағалау тапсырмалары`,
      subject: data.subject?.trim() || 'Информатика',
      grade: data.grade,
      quarter: data.quarter,
      unit: rawUnit,
      section: rawUnit,
      topic: data.topic,
      objectives,
      criteria: data.criteria,
      count: data.count,
      totalPoints: data.totalPoints,
      difficulty: data.difficulty,
      durationMinutes,
    };
  })
  .refine(data => data.unit.length >= 2, {
    message: 'Бөлімді енгізіңіз (бөлім атауы кемінде 2 таңбадан тұруы керек).',
    path: ['unit'],
  })
  .refine(data => data.objectives.length >= 1, {
    message: 'Оқу мақсатын енгізіңіз (кемінде бір оқу мақсаты қажет).',
    path: ['objectives'],
  });

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Кіру қажет.' }, { status: 401 });

  const started = Date.now();
  const provider = getAIProvider(getAIRequestConfig(request));

  try {
    const body = await request.json();
    const input = aiAssessmentInputSchema.parse(body);
    const result = await provider.generateAssessment(input);
    await recordAIRequest(user.id, 'generateAssessment', provider.name, 'succeeded', Date.now() - started);
    return NextResponse.json(result);
  } catch (error) {
    await recordAIRequest(user.id, 'generateAssessment', provider.name, 'failed', Date.now() - started);
    const formattedError = formatZodError(error);
    return NextResponse.json({ error: formattedError }, { status: 400 });
  }
}
