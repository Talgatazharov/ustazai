import { describe, expect, it } from 'vitest';
import { matchStudent, matchStudentFromText, autoDetectStudent } from './matching';
import type { Student } from '@/features/workspace/data';

const students: Student[] = [
  { id: '1', name: 'Аружан Нұрланқызы', classId: '7a', average: 85, trend: 5 },
  { id: '2', name: 'Айбек Серікұлы', classId: '7a', average: 75, trend: 2 },
];

describe('student matching', () => {
  it('matches a unique filename', () => {
    expect(matchStudent('Aruzhan_Nurlan_BJB2.jpg', students).studentId).toBe('1');
    expect(matchStudent('Аружан_БЖБ.docx', students).studentId).toBe('1');
  });

  it('requires manual choice for ambiguous or unknown filename', () => {
    expect(matchStudent('БЖБ2.pdf', students).studentId).toBeNull();
  });

  it('matches student from OCR text when filename does not match', () => {
    const ocrText = 'Оқушының аты-жөні: Айбек Серікұлы. 7А сыныбы. Тапсырмалар орындалды.';
    const textMatch = matchStudentFromText(ocrText, students);
    expect(textMatch.studentId).toBe('2');
    const result = autoDetectStudent('scan_001.jpg', ocrText, students);
    expect(result.studentId).toBe('2');
    expect(result.method).toBe('ocr_text');
  });

  it('returns manual fallback when neither filename nor text matches', () => {
    const result = autoDetectStudent('scan_001.jpg', 'Жай мәтін ешкімнің аты жоқ', students);
    expect(result.studentId).toBeNull();
    expect(result.method).toBe('manual');
  });
});
