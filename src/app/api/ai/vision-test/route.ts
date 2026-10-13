import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getOCRProvider, getOCRRequestConfig } from '@/lib/ocr/provider';
import { formatZodError } from '@/features/assessments/schema';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// A local image fixture verifies the actual image request path without uploading user data.

export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: 'Кіру қажет.' }, { status: 401 });
  try {
    const provider = getOCRProvider(getOCRRequestConfig(request));
    if (provider.name !== 'OpenAI Vision') return NextResponse.json({ ok: true, mode: 'demo', message: 'Демо Vision режимі қосулы.' });
    const sample = await readFile(path.join(process.cwd(), 'fixtures', 'vision-test.png'));
    const pages = await provider.extractText(sample, 'image/png');
    if (!pages.length) throw new Error('Vision жауабы бос болды.');
    return NextResponse.json({ ok: true, mode: 'real', message: 'Vision сервисіне қосылу сәтті.' });
  } catch (error) {
    return NextResponse.json({ error: formatZodError(error) }, { status: 400 });
  }
}
