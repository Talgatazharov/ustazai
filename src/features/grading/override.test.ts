import { describe, expect, it } from 'vitest';
import type { GradingRecord } from './types';
import { confidenceBand } from './types';

describe('teacher override and confidence calculations', () => {
  it('correctly categorizes confidence levels', () => {
    expect(confidenceBand(95)).toBe('Жоғары сенімділік');
    expect(confidenceBand(90)).toBe('Жоғары сенімділік');
    expect(confidenceBand(85)).toBe('Орташа сенімділік');
    expect(confidenceBand(70)).toBe('Орташа сенімділік');
    expect(confidenceBand(69)).toBe('Тексеру қажет');
    expect(confidenceBand(0)).toBe('Тексеру қажет');
  });

  it('calculates total score with and without teacher overrides', () => {
    const record: GradingRecord = {
      id: 'test-1',
      teacherId: 'teacher-1',
      assessmentId: 'a1',
      studentId: 's1',
      classId: '7a',
      status: 'TEACHER_REVIEW',
      originalName: 'work.docx',
      storageKey: '',
      mimeType: '',
      size: 0,
      ocrText: '',
      ocrConfidence: 90,
      ocrWarnings: [],
      items: [
        {
          questionId: 'q1',
          question: 'Сұрақ 1',
          recognizedAnswer: 'Жауап 1',
          criterion: 'Критерий 1',
          descriptorResults: [{ text: 'Д1', met: true, points: 5 }],
          aiScore: 5,
          maxScore: 5,
          confidence: 90,
          reason: 'Дұрыс',
          needsReview: false,
        },
        {
          questionId: 'q2',
          question: 'Сұрақ 2',
          recognizedAnswer: 'Жауап 2',
          criterion: 'Критерий 2',
          descriptorResults: [{ text: 'Д2', met: false, points: 5 }],
          aiScore: 0,
          teacherScore: 4, // Overridden by teacher
          maxScore: 5,
          confidence: 70,
          reason: 'Қолмен түзетілді',
          needsReview: true,
        },
      ],
      aiScore: 5,
      teacherScore: 9,
      maxScore: 10,
      audit: [
        {
          questionId: 'q2',
          oldScore: 0,
          newScore: 4,
          reason: 'Жартылай дұрыс жауап есепке алынды',
          at: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const initialAiTotal = record.items.reduce((sum, it) => sum + it.aiScore, 0);
    expect(initialAiTotal).toBe(5);

    const effectiveTotal = record.items.reduce(
      (sum, it) => sum + (it.teacherScore ?? it.aiScore),
      0
    );
    expect(effectiveTotal).toBe(9);
    expect(record.audit).toHaveLength(1);
    expect(record.audit[0].newScore).toBe(4);
  });
});
