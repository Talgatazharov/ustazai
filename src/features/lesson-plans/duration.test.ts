import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));

import { lessonDuration, type LessonContent } from '@/lib/documents/lesson-template';

describe('lesson duration and stage calculations', () => {
  const validPlan: LessonContent = {
    teacher: 'Ажаров Талғат',
    subject: 'Информатика',
    grade: '7А',
    date: '13.10.2026',
    lessonType: 'Аралас сабақ',
    unit: 'Алгоритмдер',
    topic: 'Алгоритм түрлері',
    learningObjectives: '7.1.1.1 алгоритм анықтамасын тұжырымдау',
    lessonObjectives: 'Алгоритм түрлерін ажырата білу',
    duration: 45,
    attendance: 'Қатысқандар: 15',
    start: {
      minutes: 5,
      teacher: 'Сәлемдесу, мақсат қою',
      student: 'Сұрақтарға жауап беру',
      assessment: 'Ауызша мадақтау',
      resources: 'Слайд 1-3',
    },
    middle: {
      minutes: 35,
      teacher: 'Жаңа тақырып түсіндіру',
      student: 'Тапсырма орындау',
      assessment: 'Дескриптор бойынша бағалау',
      resources: 'Оқулық, жұмыс дәптері',
    },
    end: {
      minutes: 5,
      teacher: 'Рефлексия ұйымдастыру',
      student: 'Кері байланыс беру',
      assessment: 'Өзін-өзі бағалау',
      resources: 'Кері байланыс парағы',
    },
  };

  it('calculates 45 minutes accurately when 5 + 35 + 5 = 45', () => {
    expect(lessonDuration(validPlan)).toBe(45);
    expect(lessonDuration(validPlan)).toBe(validPlan.duration);
  });

  it('detects mismatch when stage minutes do not equal lesson duration', () => {
    const invalidPlan = {
      ...validPlan,
      middle: { ...validPlan.middle, minutes: 30 }, // 5 + 30 + 5 = 40 != 45
    };
    expect(lessonDuration(invalidPlan)).toBe(40);
    expect(lessonDuration(invalidPlan) === invalidPlan.duration).toBe(false);
  });
});
