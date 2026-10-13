import { z } from 'zod';
import type { AssessmentQuestion } from '@/features/workspace/data';

export const questionTypeEnum = z.enum([
  'single',      // Бір дұрыс жауап
  'multiple',    // Бірнеше дұрыс жауап
  'true_false',  // Дұрыс / бұрыс
  'matching',    // Сәйкестендіру
  'ordering',    // Ретімен орналастыру
  'short',       // Қысқа жауап
  'open',        // Ашық жауап
  'practical',   // Практикалық тапсырма
]);

export const descriptorItemSchema = z.object({
  text: z.string().trim().min(1, 'Дескриптор мәтіні бос болмауы керек'),
  points: z.number().int().min(0, 'Дескриптор балы 0-ден кем болмауы керек').max(100),
});

export const questionSchema = z.object({
  id: z.string(),
  type: questionTypeEnum,
  question: z.string().trim().min(3, 'Сұрақ мәтіні кемінде 3 таңбадан тұруы керек'),
  answer: z.string().trim().min(1, 'Дұрыс жауап бос болмауы керек'),
  correctAnswer: z.string().trim().optional(),
  points: z.number().int().min(1, 'Тапсырма балы кемінде 1 болуы керек').max(100),
  criterion: z.string().trim().min(2, 'Бағалау критерийі бос болмауы керек'),
  criteria: z.union([z.string(), z.array(z.string())]).optional(),
  descriptors: z.array(descriptorItemSchema).min(1, 'Кемінде бір дескриптор болуы керек'),
});

export const assessmentDraftSchema = z.object({
  title: z.string().trim().min(3, 'Атауы кемінде 3 таңбадан тұруы керек'),
  subject: z.string().trim().optional(),
  grade: z.string().trim().optional(),
  quarter: z.number().int().min(1).max(4),
  unit: z.string().trim().min(2, 'Бөлім атауы бос болмауы керек'),
  section: z.string().trim().optional(),
  topic: z.string().trim().min(2, 'Тақырып бос болмауы керек'),
  objectives: z.array(z.string().trim().min(2)).min(1, 'Кемінде бір оқу мақсаты көрсетілуі керек'),
  learningObjectives: z.array(z.string().trim()).optional(),
  criteria: z.array(z.string().trim()).optional(),
  durationMinutes: z.number().int().min(1).max(240),
  duration: z.number().int().optional(),
  difficulty: z.enum(['Жеңіл', 'Орташа', 'Күрделі']),
  targetTotalPoints: z.number().int().min(1).optional(),
  totalPoints: z.number().int().optional(),
  questions: z.array(questionSchema).min(1, 'Кемінде бір тапсырма болуы керек'),
});

export type AssessmentDraft = z.infer<typeof assessmentDraftSchema>;

export function validateAssessment(draft: AssessmentDraft) {
  const issues: string[] = [];
  const seen = new Set<string>();

  // 1. Objectives validation
  const validObjectives = (draft.objectives || []).filter(o => o && o.trim().length > 0);
  if (validObjectives.length === 0) {
    issues.push('Оқу мақсаты көрсетілмеген.');
  }

  // 2. Question-level validations
  draft.questions.forEach((q, index) => {
    const num = index + 1;

    // Empty answer check
    const answer = q.answer || q.correctAnswer || '';
    if (!answer || answer.trim().length === 0) {
      issues.push(`${num}-тапсырма: Дұрыс жауап бос.`);
    }

    // Empty criterion check
    const crit = q.criterion || (Array.isArray(q.criteria) ? q.criteria[0] : q.criteria) || '';
    if (!crit || String(crit).trim().length === 0) {
      issues.push(`${num}-тапсырма: Бағалау критерийі бос.`);
    }

    // Descriptors checks
    if (!q.descriptors || q.descriptors.length === 0) {
      issues.push(`${num}-тапсырма: Дескриптор жоқ.`);
    } else {
      const emptyDesc = q.descriptors.some(d => !d.text || d.text.trim().length === 0);
      if (emptyDesc) {
        issues.push(`${num}-тапсырма: Бос дескриптор бар.`);
      }

      const descriptorTotal = q.descriptors.reduce((sum, d) => sum + d.points, 0);
      if (descriptorTotal !== q.points) {
        issues.push(`${num}-тапсырма: дескриптор балдары ${descriptorTotal}, тапсырма балы ${q.points}.`);
      }
    }

    // Duplicate questions check
    const normalized = q.question.trim().toLocaleLowerCase('kk');
    if (normalized.length > 0) {
      if (seen.has(normalized)) {
        issues.push(`${num}-тапсырма қайталанады.`);
      }
      seen.add(normalized);
    }
  });

  const totalPoints = draft.questions.reduce((sum, q) => sum + q.points, 0);

  // Target points check
  const target = draft.targetTotalPoints ?? draft.totalPoints;
  if (target && target !== totalPoints) {
    issues.push(`Тапсырмалардың жалпы балы (${totalPoints}) жоспарланған балға (${target}) сәйкес келмейді.`);
  }

  return { totalPoints, issues };
}

/**
 * Format Zod errors and technical exceptions into clear, friendly Kazakh messages.
 * Never leaks raw JSON or technical stack traces to the teacher UI.
 */
export function formatZodError(error: unknown): string {
  if (error instanceof z.ZodError) {
    const messages = error.issues.map((issue) => {
      const field = String(issue.path[issue.path.length - 1] ?? issue.path[0] ?? '');
      
      // If issue has custom Kazakh message, use it
      if (
        issue.message &&
        !issue.message.startsWith('String') &&
        !issue.message.startsWith('Expected') &&
        !issue.message.startsWith('Invalid') &&
        !issue.message.startsWith('Array must') &&
        !issue.message.startsWith('Number must') &&
        !issue.message.startsWith('Too small')
      ) {
        return issue.message;
      }

      switch (field) {
        case 'topic':
          return 'Тақырыпты енгізіңіз (кемінде 2 таңба).';
        case 'unit':
        case 'section':
          return 'Бөлімді енгізіңіз (кемінде 2 таңба).';
        case 'objectives':
        case 'learningObjectives':
          return 'Оқу мақсатын енгізіңіз (кемінде бір оқу мақсаты қажет).';
        case 'criteria':
        case 'criterion':
          return 'Бағалау критерийін көрсетіңіз.';
        case 'title':
          return 'Атауы кемінде 3 таңбадан тұруы керек.';
        case 'count':
          return 'Тапсырмалар санын 1 мен 20 аралығында көрсетіңіз.';
        case 'totalPoints':
          return 'Жалпы балды 1 мен 100 аралығында көрсетіңіз.';
        case 'grade':
          return 'Сыныпты көрсетіңіз.';
        case 'subject':
          return 'Пәнді көрсетіңіз.';
        case 'questions':
          return 'Кемінде бір тапсырма болуы керек.';
        case 'question':
          return 'Сұрақ мәтіні кемінде 3 таңбадан тұруы керек.';
        case 'answer':
        case 'correctAnswer':
          return 'Дұрыс жауап бос болмауы керек.';
        case 'descriptors':
          return 'Кемінде бір дескриптор болуы керек.';
        case 'text':
          return 'Дескриптор мәтіні бос болмауы керек.';
        default:
          return 'Міндетті өрістерді толық әрі дұрыс толтырыңыз.';
      }
    });

    return Array.from(new Set(messages)).join(' ');
  }

  if (error instanceof Error) {
    const raw = error.message.trim();

    // Check if the error message is raw JSON from Zod or an API
    if ((raw.startsWith('[') && raw.endsWith(']')) || (raw.startsWith('{') && raw.endsWith('}'))) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const msgs = parsed.map((item: { path?: string[]; message?: string; code?: string }) => {
            const field = item.path?.[item.path.length - 1] ?? item.path?.[0];
            if (field === 'topic') return 'Тақырыпты енгізіңіз.';
            if (field === 'unit' || field === 'section') return 'Бөлімді енгізіңіз.';
            if (field === 'objectives' || field === 'learningObjectives') return 'Оқу мақсатын енгізіңіз.';
            if (field === 'criteria' || field === 'criterion') return 'Бағалау критерийін көрсетіңіз.';
            if (field === 'count') return 'Тапсырмалар санын көрсетіңіз.';
            if (field === 'totalPoints') return 'Жалпы балды көрсетіңіз.';
            if (item.message && !/too small|too big|invalid|expected|string|number|array|received|undefined/i.test(item.message)) {
              return item.message;
            }
            return 'Міндетті өрісті толтырыңыз.';
          });
          return Array.from(new Set(msgs)).join(' ');
        }
      } catch {
        // Fall back to clean default
      }
      return 'Тапсырманы жасау мүмкін болмады. Тақырып пен оқу мақсатын тексеріп, қайта көріңіз.';
    }

    return raw;
  }

  if (typeof error === 'string') {
    const trimmed = error.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      return formatZodError(new Error(trimmed));
    }
    return trimmed;
  }

  return 'Тапсырманы жасау мүмкін болмады. Тақырып пен оқу мақсатын тексеріп, қайта көріңіз.';
}

/**
 * Strips markdown code fences (```json ... ``` or ``` ... ```) and extracts JSON string.
 */
export function cleanMarkdownJson(text: string): string {
  if (typeof text !== 'string') return '';
  let cleaned = text.trim();

  // Strip leading and trailing markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();

  // Extract from first { to last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

/**
 * Safely parses JSON from string or returns input object.
 */
export function cleanAndParseJson<T = unknown>(input: unknown): T {
  if (typeof input === 'object' && input !== null) {
    return input as T;
  }
  if (typeof input !== 'string') {
    throw new Error('AI жауабы бос немесе қате форматта.');
  }

  const cleaned = cleanMarkdownJson(input);
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error('AI жарамды JSON қайтармады: ' + (err instanceof Error ? err.message : String(err)));
  }
}

/**
 * Normalizes question types into supported system types.
 */
export function normalizeQuestionType(rawType: unknown): AssessmentQuestion['type'] {
  if (typeof rawType !== 'string') return 'short';
  const val = rawType.toLowerCase().trim();
  if (val === 'single' || val === 'single_choice' || val === 'choice' || val === 'radio') return 'single';
  if (val === 'multiple' || val === 'multiple_choice' || val === 'multiselect') return 'multiple';
  if (val === 'true_false' || val === 'boolean' || val === 'true/false' || val === 'дұрыс/бұрыс') return 'true_false';
  if (val === 'matching' || val === 'match' || val === 'сәйкестендіру') return 'matching';
  if (val === 'ordering' || val === 'order' || val === 'sequence' || val === 'ретімен') return 'ordering';
  if (val === 'open' || val === 'essay' || val === 'ашық') return 'open';
  if (val === 'practical' || val === 'practice' || val === 'практикалық') return 'practical';
  return 'short';
}

export interface RawAIQuestion {
  id?: string;
  type?: string;
  question?: string;
  prompt?: string;
  text?: string;
  answer?: string;
  correctAnswer?: string;
  expectedAnswer?: string;
  points?: number;
  criterion?: string;
  criteria?: string | string[];
  descriptors?: Array<{ text?: string; description?: string; name?: string; points?: number }>;
}

export interface RawAIAssessmentResponse {
  title?: string;
  subject?: string;
  grade?: string;
  quarter?: number;
  section?: string;
  unit?: string;
  topic?: string;
  objectives?: string[];
  learningObjectives?: string[];
  criteria?: string[];
  duration?: number;
  durationMinutes?: number;
  difficulty?: string;
  totalPoints?: number;
  questions?: RawAIQuestion[];
}

/**
 * Safe normalization layer: converts raw AI responses (or objects with various naming conventions)
 * into a canonical, strictly validated assessment structure with aligned points and descriptors.
 */
export function normalizeAssessmentAIResponse(
  raw: unknown,
  fallback?: {
    title?: string;
    topic?: string;
    unit?: string;
    objectives?: string[];
    criteria?: string[];
    totalPoints?: number;
    count?: number;
    grade?: string;
    subject?: string;
  }
): {
  title: string;
  section: string;
  unit: string;
  topic: string;
  objectives: string[];
  criteria: string[];
  totalPoints: number;
  questions: AssessmentQuestion[];
} {
  const data = (typeof raw === 'string' ? cleanAndParseJson<RawAIAssessmentResponse>(raw) : (raw ?? {})) as RawAIAssessmentResponse;

  const topic = (data.topic || fallback?.topic || '').trim() || 'Тақырып';
  const unit = (data.unit || data.section || fallback?.unit || '').trim() || 'Бөлім';
  const title = (data.title || fallback?.title || `${topic} — бағалау`).trim();

  const rawObjectives = data.objectives?.length
    ? data.objectives
    : (data.learningObjectives?.length ? data.learningObjectives : (fallback?.objectives ?? []));
  const objectives = rawObjectives.map(o => String(o).trim()).filter(Boolean);
  if (objectives.length === 0) {
    objectives.push(`${topic} бойынша оқу мақсаты`);
  }

  const rawCriteria = data.criteria?.length ? data.criteria : (fallback?.criteria ?? []);
  const criteria = rawCriteria.map(c => String(c).trim()).filter(Boolean);

  const rawQuestions: RawAIQuestion[] = Array.isArray(data.questions) ? data.questions : [];
  const targetTotal = fallback?.totalPoints && fallback.totalPoints > 0 ? fallback.totalPoints : 20;

  // Normalize questions
  const normalizedQuestions: AssessmentQuestion[] = rawQuestions.map((q, idx) => {
    const id = q.id && String(q.id).trim() ? String(q.id).trim() : crypto.randomUUID();
    const type = normalizeQuestionType(q.type);
    const questionText = (q.question || q.prompt || q.text || `${idx + 1}-сұрақ`).trim();
    const answerText = (q.answer || q.correctAnswer || q.expectedAnswer || 'Дұрыс жауап').trim();

    let criterionText = '';
    if (typeof q.criterion === 'string' && q.criterion.trim()) {
      criterionText = q.criterion.trim();
    } else if (Array.isArray(q.criteria) && q.criteria[0]) {
      criterionText = String(q.criteria[0]).trim();
    } else if (typeof q.criteria === 'string' && q.criteria.trim()) {
      criterionText = q.criteria.trim();
    } else if (criteria[idx]) {
      criterionText = criteria[idx];
    } else {
      criterionText = `${topic} ұғымын түсінеді және қолданады`;
    }

    const qPoints = Math.max(1, Math.round(Number(q.points) || 1));

    let descriptors: { text: string; points: number }[] = [];
    if (Array.isArray(q.descriptors) && q.descriptors.length > 0) {
      descriptors = q.descriptors.map(d => ({
        text: (d.text || d.description || d.name || 'Талапқа сәйкес орындайды').trim(),
        points: Math.max(0, Math.round(Number(d.points) || 0)),
      })).filter(d => d.text.length > 0);
    }

    if (descriptors.length === 0) {
      descriptors = [{ text: `${criterionText} бойынша дұрыс жауап береді`, points: qPoints }];
    }

    // Ensure descriptors sum equals qPoints
    const descSum = descriptors.reduce((s, d) => s + d.points, 0);
    if (descSum !== qPoints) {
      if (descriptors.length === 1) {
        descriptors[0].points = qPoints;
      } else {
        const diff = qPoints - descSum;
        const lastIdx = descriptors.length - 1;
        if (descriptors[lastIdx].points + diff >= 0) {
          descriptors[lastIdx].points += diff;
        } else {
          const base = Math.floor(qPoints / descriptors.length);
          const rem = qPoints % descriptors.length;
          descriptors.forEach((d, i) => {
            d.points = base + (i === descriptors.length - 1 ? rem : 0);
          });
        }
      }
    }

    return {
      id,
      type,
      question: questionText,
      answer: answerText,
      points: qPoints,
      criterion: criterionText,
      descriptors,
    };
  });

  // Reconcile total points if targetTotal is given and questions exist
  if (normalizedQuestions.length > 0 && targetTotal > 0) {
    const currentSum = normalizedQuestions.reduce((s, q) => s + q.points, 0);
    if (currentSum !== targetTotal) {
      const diff = targetTotal - currentSum;
      const lastQ = normalizedQuestions[normalizedQuestions.length - 1];
      if (lastQ.points + diff >= 1) {
        lastQ.points += diff;
        const descDiff = lastQ.points - lastQ.descriptors.reduce((s, d) => s + d.points, 0);
        lastQ.descriptors[lastQ.descriptors.length - 1].points += descDiff;
      } else {
        const base = Math.floor(targetTotal / normalizedQuestions.length);
        const rem = targetTotal % normalizedQuestions.length;
        normalizedQuestions.forEach((q, i) => {
          q.points = Math.max(1, base + (i === normalizedQuestions.length - 1 ? rem : 0));
          const dSum = q.descriptors.reduce((s, d) => s + d.points, 0);
          const dDiff = q.points - dSum;
          q.descriptors[q.descriptors.length - 1].points += dDiff;
        });
      }
    }
  }

  const finalTotal = normalizedQuestions.reduce((s, q) => s + q.points, 0);

  return {
    title,
    section: unit,
    unit,
    topic,
    objectives,
    criteria,
    totalPoints: finalTotal,
    questions: normalizedQuestions,
  };
}
