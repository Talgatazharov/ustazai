import { describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

vi.mock('server-only', () => ({}));

import { lessonSchema, lessonDuration, generateLessonDocx, analyzeTemplate, type LessonContent } from '@/lib/documents/lesson-template';

const templateExists = existsSync(path.join(process.cwd(), 'templates/private/canonical-kmz.docx'));

describe('ҚМЖ acceptance test — Python lesson pedagogical and template verification', () => {
  const pythonPlan: LessonContent = {
    teacher: 'Ажаров Талғат',
    subject: 'Информатика',
    grade: '7А',
    date: '13.10.2026',
    lessonType: 'Аралас сабақ',
    unit: 'Бағдарламалау (Python)',
    topic: 'Python-дағы шартты операторлар (if, elif, else)',
    learningObjectives: '7.3.2.1 программада тармақталу командаларын қолдану (if, elif, else)',
    lessonObjectives: 'Барлық оқушылар: Python-да шартты операторлардың синтаксисін біледі. Көпшілігі: есептің шарты бойынша программа жазады. Кейбірі: шегініс қателерін түзетеді.',
    duration: 45,
    attendance: 'Қатысқандар: 24, Қатыспағандар: 0',
    start: {
      minutes: 5,
      teacher: 'Сабақтың басында «if x > 0» мысалы бойынша код нәтижесін болжатқызады.',
      student: 'Мысал нәтижесін болжайды және сабақ мақсатымен танысады.',
      assessment: 'Ауызша кері байланыс, белсенділікті мадақтау.',
      resources: 'Интербелсенді тақта, код карточкалары',
    },
    middle: {
      minutes: 35,
      teacher: 'if/elif/else тармақтарының орындалу ретін кодпен көрсетеді. 1) Код нәтижесін болжау; 2) шегініс қатесін табу; 3) сан таңбасын анықтайтын программа жазу тапсырмаларын береді.',
      student: 'Код нәтижесін жазады, шегініс қатесін түзетеді, if/elif/else қолданып программа құрады және тексереді.',
      assessment: 'Дескрипторлар: 1) if, elif шарттарын дұрыс жазады (1 балл); 2) шегіністі сақтайды (1 балл); 3) үш сынақ мәнімен нәтижені тексереді (2 балл).',
      resources: 'Python ортасы, тапсырма парағы, бағалау парағы',
    },
    end: {
      minutes: 5,
      teacher: 'Сабақты қорытындылап, шығу билетін береді.',
      student: 'Шығу билеті бойынша үйренгенін және қиындық тудырған тұсын жазады.',
      assessment: 'Шығу билеті: шағын логикалық сұраққа жауап беру.',
      resources: 'Рефлексия парақшасы',
    },
  };

  it('validates lesson structure against Zod schema', () => {
    const parsed = lessonSchema.parse(pythonPlan);
    expect(parsed.teacher).toBe('Ажаров Талғат');
    expect(parsed.duration).toBe(45);
  });

  it('strictly validates that stage minutes equal lesson duration (5 + 35 + 5 = 45)', () => {
    expect(lessonDuration(pythonPlan)).toBe(45);
    expect(pythonPlan.start.minutes).toBe(5);
    expect(pythonPlan.middle.minutes).toBe(35);
    expect(pythonPlan.end.minutes).toBe(5);
  });

  it('middle stage contains pedagogical requirements: numbered tasks and python syntax', () => {
    expect(pythonPlan.middle.teacher).toMatch(/1\)/);
    expect(pythonPlan.middle.teacher).toMatch(/2\)/);
    expect(pythonPlan.middle.teacher).toMatch(/3\)/);
    expect(pythonPlan.middle.teacher).toMatch(/if|elif/i);
    expect(pythonPlan.middle.assessment).toContain('Дескрипторлар');
  });

  it.skipIf(!templateExists)('generates valid Word DOCX with ZERO old content leak and exact table structure', async () => {
    const before = await analyzeTemplate();
    const result = await generateLessonDocx(pythonPlan);

    expect(result.validation.sameStructure).toBe(true);
    expect(result.buffer).toBeInstanceOf(Buffer);

    const zip = await JSZip.loadAsync(result.buffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect((xml.match(/<w:tbl[ >]/g) || []).length).toBe(before.tableCount);

    // New lesson plan content MUST be present
    expect(xml).toContain('Ажаров Талғат');
    expect(xml).toContain('Python-дағы шартты операторлар');
    expect(xml).toContain('7.3.2.1');

    // Canonical old lesson content MUST be completely stripped
    expect(xml).not.toContain('Жай бөлшектің негізгі қасиеті');
    expect(xml).not.toContain('Сағидолла');
    expect(xml).not.toContain('Алдамұратова');
    expect(xml).not.toContain('№375');

    // Verify all body rows 10, 12..16 are cleared
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const table = doc.getElementsByTagName('w:tbl')[0];
    const rows = Array.from(table.getElementsByTagName('w:tr'));

    for (const rowIndex of [10, 12, 13, 14, 15, 16]) {
      const cells = Array.from(rows[rowIndex].childNodes).filter(node => node.nodeName === 'w:tc');
      for (const cell of cells) {
        expect((cell.textContent ?? '').trim(), `Row ${rowIndex} must be clean of old text`).toBe('');
      }
    }
  });
});
