import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn().mockResolvedValue({ id: 'teacher-1', name: 'Ажаров Талғат' }),
}));

import { POST } from '@/app/api/ai/lesson-plan/route';

describe('/api/ai/lesson-plan route logic', () => {
  const baseRequest = {
    teacher: 'Ажаров Талғат',
    subject: 'Информатика',
    grade: '7А',
    date: '13.10.2026',
    lessonType: 'Аралас сабақ',
    unit: 'Бағдарламалау (Python)',
    topic: 'Python-дағы шартты операторлар (if, elif, else)',
    learningObjectives: '7.3.2.1 программада тармақталу командаларын қолдану',
    lessonObjectives: '',
    aiGenerateObjectives: true,
    duration: 45,
    customInstruction: 'Практикалық тапсырманы көбейт',
    regenerateSection: 'all',
  };

  it('automatically drafts measurable lesson objectives when aiGenerateObjectives is true', async () => {
    const req = new Request('http://localhost:3107/api/ai/lesson-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(baseRequest),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.lessonObjectives).toBeTruthy();
    expect(json.data.lessonObjectives).toContain('Python');
    expect(json.data.duration).toBe(45);
    expect(json.data.start.minutes + json.data.middle.minutes + json.data.end.minutes).toBe(45);
    expect(json.data.middle.teacher).toMatch(/1\)/);
  });

  it('regenerates only the middle section when regenerateSection="middle", preserving start and end', async () => {
    const existingStart = {
      minutes: 6,
      teacher: 'Мұғалімнің қолмен енгізген арнайы кіріспесі',
      student: 'Оқушы амандасады',
      assessment: 'Ауызша',
      resources: 'Тақта',
    };
    const existingEnd = {
      minutes: 4,
      teacher: 'Мұғалімнің қолмен енгізген қорытындысы',
      student: 'Оқушы рефлексия жазады',
      assessment: 'Билет',
      resources: 'Стикер',
    };

    const req = new Request('http://localhost:3107/api/ai/lesson-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...baseRequest,
        regenerateSection: 'middle',
        start: existingStart,
        end: existingEnd,
        middle: { minutes: 35, teacher: 'ескі', student: '', assessment: '', resources: '' },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    // Preserves existing start and end teacher text
    expect(json.data.start.teacher).toBe(existingStart.teacher);
    expect(json.data.end.teacher).toBe(existingEnd.teacher);
    // Updated middle
    expect(json.data.middle.teacher).not.toBe('ескі');
    // Total duration still strictly 45
    expect(json.data.start.minutes + json.data.middle.minutes + json.data.end.minutes).toBe(45);
  });

  it('rejects requests with missing required fields with friendly Kazakh messages', async () => {
    const req = new Request('http://localhost:3107/api/ai/lesson-plan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...baseRequest, topic: '' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toMatch(/тақырып|тақырыб/);
  });
});
