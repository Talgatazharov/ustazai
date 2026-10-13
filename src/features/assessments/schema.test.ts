import { describe, expect, it } from 'vitest';
import {
  assessmentDraftSchema,
  validateAssessment,
  formatZodError,
  cleanMarkdownJson,
  cleanAndParseJson,
  normalizeAssessmentAIResponse,
} from './schema';

describe('assessment validation', () => {
  const draft = {
    title: 'Алгоритмдер',
    quarter: 1,
    unit: 'Алгоритм',
    topic: 'Қадамдар',
    objectives: ['Реттілікті анықтау'],
    durationMinutes: 40,
    difficulty: 'Орташа' as const,
    questions: [
      {
        id: 'q1',
        type: 'short' as const,
        question: 'Қадам деген не?',
        answer: 'Әрекет',
        points: 2,
        criterion: 'Дұрыс жауап',
        descriptors: [{ text: 'Әрекетті атайды', points: 2 }],
      },
    ],
  };

  it('calculates total points and accepts a valid draft', () => {
    const parsed = assessmentDraftSchema.parse(draft);
    expect(validateAssessment(parsed)).toEqual({ totalPoints: 2, issues: [] });
  });

  it('flags descriptor mismatch and duplicate questions', () => {
    const invalid = {
      ...draft,
      questions: [
        draft.questions[0],
        { ...draft.questions[0], id: 'q2', points: 3 },
      ],
    };
    const result = validateAssessment(invalid);
    expect(result.totalPoints).toBe(5);
    expect(result.issues).toHaveLength(2);
  });

  it('validates target total points mismatch', () => {
    const withTarget = {
      ...draft,
      targetTotalPoints: 10,
    };
    const result = validateAssessment(withTarget);
    expect(result.issues.some(i => i.includes('сәйкес келмейді'))).toBe(true);
  });

  it('requires an answer and criterion', () => {
    expect(
      assessmentDraftSchema.safeParse({
        ...draft,
        questions: [{ ...draft.questions[0], answer: '', criterion: '' }],
      }).success
    ).toBe(false);
  });
});

describe('formatZodError', () => {
  it('formats missing topic into Kazakh message', () => {
    const parsed = assessmentDraftSchema.safeParse({
      title: 'Тест',
      quarter: 1,
      unit: 'Бөлім',
      topic: '',
      objectives: ['Мақсат'],
      durationMinutes: 40,
      difficulty: 'Орташа',
      questions: [],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const msg = formatZodError(parsed.error);
      expect(msg).toContain('Тақырып');
      expect(msg).not.toContain('{');
      expect(msg).not.toContain('"code"');
    }
  });

  it('parses raw JSON error string into readable Kazakh', () => {
    const rawJsonError = JSON.stringify([
      { code: 'too_small', path: ['topic'], message: 'Too small' },
      { code: 'too_small', path: ['unit'], message: 'Too small' },
    ]);
    const msg = formatZodError(new Error(rawJsonError));
    expect(msg).toContain('Тақырып');
    expect(msg).toContain('Бөлім');
    expect(msg).not.toContain('too_small');
  });

  it('does not expose a raw unit validation error', () => {
    const raw = JSON.stringify([{ origin: 'string', code: 'too_small', minimum: 2, path: ['unit'], message: 'Too small: expected string to have >=2 characters' }]);
    expect(formatZodError(new Error(raw))).toBe('Бөлімді енгізіңіз.');
  });
});

describe('cleanMarkdownJson and cleanAndParseJson', () => {
  it('strips markdown code fence with json tag', () => {
    const input = '```json\n{"title": "Python"}\n```';
    expect(cleanMarkdownJson(input)).toBe('{"title": "Python"}');
    expect(cleanAndParseJson<{ title: string }>(input).title).toBe('Python');
  });

  it('extracts JSON surrounded by text comments', () => {
    const input = 'Міне сізге тапсырма:\n```\n{"title": "Алгоритм"}\n```\nСәттілік!';
    const parsed = cleanAndParseJson<{ title: string }>(input);
    expect(parsed.title).toBe('Алгоритм');
  });
});

describe('normalizeAssessmentAIResponse', () => {
  it('normalizes response with aliases: section, correctAnswer, criteria', () => {
    const rawAiOutput = {
      title: 'Python негіздері',
      section: 'Программалау',
      topic: 'Python тілінің негіздері',
      objectives: ['Python программасының негізгі құрылымын түсіну'],
      criteria: ['Python синтаксисін дұрыс қолданады'],
      questions: [
        {
          id: 'q1',
          type: 'short',
          question: 'Python тіліндегі айнымалы дегеніміз не?',
          correctAnswer: 'Мәнді сақтауға арналған атаулы жад аймағы',
          points: 2,
          criterion: 'Айнымалы ұғымын түсіндіреді',
          descriptors: [
            { text: 'Айнымалының қызметін дұрыс түсіндіреді', points: 1 },
            { text: 'Айнымалыға мысал келтіреді', points: 1 },
          ],
        },
      ],
    };

    const normalized = normalizeAssessmentAIResponse(rawAiOutput, {
      totalPoints: 2,
    });

    expect(normalized.unit).toBe('Программалау');
    expect(normalized.section).toBe('Программалау');
    expect(normalized.questions[0].answer).toBe('Мәнді сақтауға арналған атаулы жад аймағы');
    expect(normalized.questions[0].points).toBe(2);
    expect(normalized.questions[0].descriptors).toHaveLength(2);

    const validation = validateAssessment({
      ...normalized,
      quarter: 1,
      durationMinutes: 40,
      difficulty: 'Орташа',
      targetTotalPoints: 2,
    });
    expect(validation.issues).toEqual([]);
    expect(validation.totalPoints).toBe(2);
  });

  it('adjusts descriptor points and total points when arithmetic has minor mismatch', () => {
    const rawAiOutput = {
      title: 'Тест',
      topic: 'Циклдер',
      unit: 'Бағдарламалау',
      objectives: ['Цикл құру'],
      questions: [
        {
          id: 'q1',
          type: 'short',
          question: 'for циклі қалай жазылады?',
          correctAnswer: 'for i in range(...)',
          points: 5,
          criterion: 'Циклді қолданады',
          descriptors: [{ text: 'Синтаксисті жазады', points: 2 }], // mismatch: 2 !== 5
        },
      ],
    };

    const normalized = normalizeAssessmentAIResponse(rawAiOutput, {
      totalPoints: 5,
    });

    expect(normalized.questions[0].points).toBe(5);
    // Descriptor was adjusted to match question points 5
    const descSum = normalized.questions[0].descriptors.reduce((s, d) => s + d.points, 0);
    expect(descSum).toBe(5);

    const validation = validateAssessment({
      ...normalized,
      quarter: 1,
      durationMinutes: 40,
      difficulty: 'Орташа',
      targetTotalPoints: 5,
    });
    expect(validation.issues).toEqual([]);
  });
});
