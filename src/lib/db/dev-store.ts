import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { demoData, type WorkspaceData } from '@/features/workspace/data';
import type { GradingRecord } from '@/features/grading/types';

export type DevUser = { id: string; email: string; name: string; passwordHash: string; role: 'TEACHER'|'ADMIN'|'STUDENT'; school?: string; subject?: string; onboardingDone?: boolean };
export type DevDatabase = { users: DevUser[]; workspaces: Record<string, WorkspaceData>; grading?:GradingRecord[];aiRequests?:{id:string;userId:string;action:string;model:string;status:string;durationMs:number;createdAt:string}[] };
const file = path.join(process.cwd(), '.data', 'development.json');
let queue: Promise<unknown> = Promise.resolve();

async function read(): Promise<DevDatabase> {
  try {
    const db = JSON.parse(await fs.readFile(file, 'utf8')) as DevDatabase;
    db.grading ??= [];
    return db;
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { users: [], workspaces: {}, grading: [] };
    throw error;
  }
}

async function write(db: DevDatabase) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temp, JSON.stringify(db), { encoding: 'utf8', mode: 0o600 });
  await fs.rename(temp, file);
}

export async function devRead<T>(fn: (db: DevDatabase) => T): Promise<T> { return fn(await read()); }
export async function devWrite<T>(fn: (db: DevDatabase) => T | Promise<T>): Promise<T> {
  const task = queue.then(async () => { const db = await read(); const result = await fn(db); await write(db); return result; });
  queue = task.catch(() => undefined);
  return task;
}

export function newWorkspace(): WorkspaceData { return structuredClone(demoData); }

export function newDemoGrading(teacherId: string): GradingRecord[] {
  const now = new Date().toISOString();

  // 7A records on a1 ('Алгоритмдер және орындаушылар')
  const class7aStudents = [
    { id: 'student-1', name: 'Аружан Нұрланқызы', score: 9 },
    { id: 'student-2', name: 'Айбек Серікұлы', score: 7 },
    { id: 'student-3', name: 'Данияр Ермекұлы', score: 5 },
    { id: 'student-4', name: 'Әли Омаров', score: 10 },
    { id: 'student-5', name: 'Мадина Қайратқызы', score: 8 },
    { id: 'student-6', name: 'Нұрай Асқарқызы', score: 6 },
    { id: 'student-7', name: 'Іңкәр Бақытқызы', score: 9 },
    { id: 'student-8', name: 'Ерасыл Мұратұлы', score: 7 },
  ];

  const records7a: GradingRecord[] = class7aStudents.map((s, index) => {
    const score = s.score;
    const q1Score = Math.min(5, Math.ceil(score / 2));
    const q2Score = Math.max(0, score - q1Score);
    return {
      id: `demo-grade-${teacherId}-7a-${index}`,
      teacherId,
      assessmentId: 'a1',
      studentId: s.id,
      classId: '7a',
      status: 'APPROVED',
      originalName: `${s.name.replace(/\s+/g, '_')}_BJB1.docx`,
      storageKey: '',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 15420,
      ocrText: 'Алгоритм — нақты қадамдар тізбегі. Мысалы: таңертеңгілік жаттығу жасау тәртібі.',
      ocrConfidence: 94,
      ocrWarnings: [],
      items: [
        {
          questionId: 'q-a1-1',
          question: 'Алгоритм дегеніміз не?',
          recognizedAnswer: 'Нақты қадамдар тізбегі',
          criterion: 'Алгоритм ұғымын түсіндіреді',
          descriptorResults: [
            { text: 'Алгоритмнің қадамдардан тұратынын атайды', met: q1Score >= 3, points: 3 },
            { text: 'Қадамдардың ретімен орындалатынын түсіндіреді', met: q1Score >= 5, points: 2 },
          ],
          aiScore: q1Score,
          teacherScore: q1Score,
          maxScore: 5,
          confidence: 94,
          reason: 'Критерийлерге толық сәйкес',
          needsReview: false,
        },
        {
          questionId: 'q-a1-2',
          question: 'Күнделікті өмірден алгоритмге мысал келтіріңіз.',
          recognizedAnswer: 'Шай дайындау, жаттығу жасау',
          criterion: 'Алгоритмге мысал келтіреді',
          descriptorResults: [
            { text: 'Сәйкес мысал келтіреді', met: q2Score >= 3, points: 3 },
            { text: 'Қадамдардың ретін көрсетеді', met: q2Score >= 5, points: 2 },
          ],
          aiScore: q2Score,
          teacherScore: q2Score,
          maxScore: 5,
          confidence: 90,
          reason: 'Мысал дұрыс берілген',
          needsReview: false,
        },
      ],
      aiScore: score,
      teacherScore: score,
      maxScore: 10,
      approvedAt: now,
      audit: [],
      createdAt: new Date(Date.now() - (8 - index) * 86400000).toISOString(),
    };
  });

  // 8B records on a2 ('Python негіздері')
  const class8bStudents = [
    { id: 'student-13', name: 'Аяулым Бекзатқызы', score: 7 },
    { id: 'student-14', name: 'Мирас Алмасұлы', score: 9 },
    { id: 'student-15', name: 'Ілияс Ержанұлы', score: 8 },
    { id: 'student-16', name: 'Назерке Жанболатқызы', score: 10 },
  ];

  const records8b: GradingRecord[] = class8bStudents.map((s, index) => {
    return {
      id: `demo-grade-${teacherId}-8b-${index}`,
      teacherId,
      assessmentId: 'a2',
      studentId: s.id,
      classId: '8b',
      status: 'APPROVED',
      originalName: `${s.name.replace(/\s+/g, '_')}_Python_BJB.docx`,
      storageKey: '',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 14200,
      ocrText: 'print("Сәлем әлем")',
      ocrConfidence: 96,
      ocrWarnings: [],
      items: [
        {
          questionId: 'q-a2-1',
          question: 'Экранға мәтін шығару функциясын жазыңыз.',
          recognizedAnswer: 'print()',
          criterion: 'Шығару функциясын қолданады',
          descriptorResults: [
            { text: 'print функциясын дұрыс жазады', met: s.score >= 8, points: 10 },
          ],
          aiScore: s.score,
          teacherScore: s.score,
          maxScore: 10,
          confidence: 96,
          reason: 'Дұрыс синтаксис',
          needsReview: false,
        },
      ],
      aiScore: s.score,
      teacherScore: s.score,
      maxScore: 10,
      approvedAt: now,
      audit: [],
      createdAt: new Date(Date.now() - (5 - index) * 86400000).toISOString(),
    };
  });

  // 9A records on a3 ('Ақпараттық жүйелер' ТЖБ)
  const class9aStudents = [
    { id: 'student-18', name: 'Әсем Нұрболқызы', score: 8 },
    { id: 'student-19', name: 'Рамазан Саятұлы', score: 6 },
    { id: 'student-20', name: 'Дильназ Ерланқызы', score: 9 },
  ];

  const records9a: GradingRecord[] = class9aStudents.map((s, index) => {
    return {
      id: `demo-grade-${teacherId}-9a-${index}`,
      teacherId,
      assessmentId: 'a3',
      studentId: s.id,
      classId: '9a',
      status: 'APPROVED',
      originalName: `${s.name.replace(/\s+/g, '_')}_TJB1.docx`,
      storageKey: '',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 16100,
      ocrText: 'Ақпараттық жүйе — мәліметтерді сақтау, өңдеу және іздеуге арналған кешен.',
      ocrConfidence: 92,
      ocrWarnings: [],
      items: [
        {
          questionId: 'q-a3-1',
          question: 'Ақпараттық жүйенің қызметін түсіндіріңіз.',
          recognizedAnswer: 'Ақпаратты жинау, сақтау, өңдеу',
          criterion: 'Ақпараттық жүйенің қызметін түсіндіреді',
          descriptorResults: [
            { text: 'Ақпаратты жинауды атайды', met: s.score >= 6, points: 3 },
            { text: 'Сақтауды атайды', met: s.score >= 7, points: 3 },
            { text: 'Өңдеуді түсіндіреді', met: s.score >= 9, points: 4 },
          ],
          aiScore: s.score,
          teacherScore: s.score,
          maxScore: 10,
          confidence: 92,
          reason: 'Толық анықтама',
          needsReview: false,
        },
      ],
      aiScore: s.score,
      teacherScore: s.score,
      maxScore: 10,
      approvedAt: now,
      audit: [],
      createdAt: new Date(Date.now() - (4 - index) * 86400000).toISOString(),
    };
  });

  return [...records7a, ...records8b, ...records9a];
}

export function ensureDemoGrading(db: DevDatabase, teacherId: string): void {
  db.grading ??= [];
  const existing = db.grading.filter(r => r.teacherId === teacherId);
  if (existing.length === 0) {
    db.grading.push(...newDemoGrading(teacherId));
  }
}
