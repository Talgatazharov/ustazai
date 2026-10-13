import type { Student } from '@/features/workspace/data';

const translitMap: Record<string, string> = {
  sh: 'ш', ch: 'ч', zh: 'ж', gh: 'ғ', kh: 'х', th: 'т',
  a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', e: 'е',
  z: 'з', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н',
  o: 'о', p: 'п', r: 'р', s: 'с', t: 'т', u: 'у', f: 'ф',
  q: 'қ', y: 'й', w: 'у',
};

function transliterate(str: string): string {
  let lower = str.toLowerCase();
  // Multi-character replacements first
  lower = lower
    .replace(/sh/g, 'ш')
    .replace(/ch/g, 'ч')
    .replace(/zh/g, 'ж')
    .replace(/gh/g, 'ғ')
    .replace(/kh/g, 'х');

  let res = '';
  for (const ch of lower) {
    res += translitMap[ch] || ch;
  }
  return res;
}

function normalize(value: string) {
  const cleaned = value.toLocaleLowerCase('kk').replace(/[^\p{L}\p{N}]+/gu, '');
  return transliterate(cleaned);
}

export function matchStudent(filename: string, students: Student[]) {
  const fileNorm = normalize(filename.replace(/\.[^.]+$/, ''));
  const matches = students.filter(student => {
    const parts = student.name.split(/\s+/).filter(part => part.length >= 3);
    return parts.some(part => {
      const pNorm = normalize(part);
      return fileNorm.includes(pNorm) || (pNorm.length >= 4 && pNorm.slice(0, 4).length && fileNorm.includes(pNorm.slice(0, 4)));
    });
  });
  return matches.length === 1
    ? { studentId: matches[0].id, confidence: 90, method: 'filename' as const }
    : { studentId: null, confidence: 0, method: 'manual' as const };
}

export function matchStudentFromText(text: string, students: Student[]) {
  const textNorm = normalize(text);
  const matches = students.filter(student => {
    const parts = student.name.split(/\s+/).filter(part => part.length >= 3);
    return parts.length > 0 && parts.every(part => textNorm.includes(normalize(part)));
  });
  return matches.length === 1
    ? { studentId: matches[0].id, confidence: 85, method: 'ocr_text' as const }
    : { studentId: null, confidence: 0, method: 'manual' as const };
}

export function autoDetectStudent(filename: string, text: string, students: Student[]) {
  const fileMatch = matchStudent(filename, students);
  if (fileMatch.studentId) return fileMatch;
  if (text) {
    const textMatch = matchStudentFromText(text, students);
    if (textMatch.studentId) return textMatch;
  }
  return { studentId: null, confidence: 0, method: 'manual' as const };
}
