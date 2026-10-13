import 'server-only';
import OpenAI from 'openai';
import { z } from 'zod';
import { prisma, useDevStore } from '@/lib/db/client';
import { devWrite } from '@/lib/db/dev-store';
import {
  validateAssessment,
  cleanAndParseJson,
  normalizeAssessmentAIResponse,
  formatZodError,
} from '@/features/assessments/schema';
import type { AssessmentQuestion } from '@/features/workspace/data';
import { AI_CONFIG } from '@/config/ai.config';

const descriptorSchema = z.object({
  text: z.string().trim().min(1),
  points: z.coerce.number().int(),
});

export const generatedQuestionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['single', 'multiple', 'true_false', 'short', 'open', 'matching', 'ordering', 'practical']),
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  correctAnswer: z.string().trim().optional(),
  points: z.coerce.number().int().min(1),
  criterion: z.string().trim().min(1),
  criteria: z.union([z.string(), z.array(z.string())]).optional(),
  descriptors: z.array(descriptorSchema).min(1),
});

export const generatedAssessmentSchema = z.object({
  title: z.string().trim().min(1),
  section: z.string().optional(),
  unit: z.string().optional(),
  topic: z.string().optional(),
  objectives: z.array(z.string()).optional(),
  criteria: z.array(z.string()).optional(),
  questions: z.array(generatedQuestionSchema),
});

export type AssessmentPrompt = {
  title?: string;
  subject?: string;
  grade: string;
  quarter?: number;
  section?: string;
  unit: string;
  topic: string;
  objectives: string[];
  criteria?: string[];
  count: number;
  totalPoints: number;
  difficulty?: string;
  durationMinutes?: number;
};

export type GeneratedAssessment = {
  title: string;
  section?: string;
  unit?: string;
  topic?: string;
  objectives?: string[];
  criteria?: string[];
  totalPoints?: number;
  questions: AssessmentQuestion[];
  mode: 'demo' | 'real';
};

export interface AIProvider {
  name: string;
  mode: 'demo' | 'real';
  generateStructured<T>(schema: z.ZodType<T>, name: string, prompt: string, mockValue: T): Promise<T>;
  generateAssessment(input: AssessmentPrompt): Promise<GeneratedAssessment>;
  generateLessonPlan(prompt: string): Promise<{ text: string; mode: 'demo' | 'real' }>;
  generateTest(prompt: string): Promise<{ text: string; mode: 'demo' | 'real' }>;
  generateFeedback(prompt: string): Promise<{ text: string; mode: 'demo' | 'real' }>;
  generateInsight(prompt: string): Promise<{ text: string; mode: 'demo' | 'real' }>;
}

const curated = [
  {
    keyword: 'алгоритм',
    question: 'Алгоритм дегеніміз не?',
    answer: 'Мақсатқа жету үшін орындалатын нақты қадамдар тізбегі',
    criterion: 'Алгоритм ұғымын түсіндіреді',
    descriptor: 'Қадамдар тізбегі екенін атайды',
  },
  {
    keyword: 'python',
    question: 'Python тілінде экранға мәтін шығаратын функция қалай аталады?',
    answer: 'print()',
    criterion: 'Python-дағы шығару функциясын атайды',
    descriptor: 'print() функциясын жазады',
  },
  {
    keyword: 'цикл',
    question: 'Цикл не үшін қолданылады?',
    answer: 'Әрекеттерді қайталап орындау үшін',
    criterion: 'Цикл мақсатын түсіндіреді',
    descriptor: 'Қайталау әрекетін атайды',
  },
];

const mockProvider: AIProvider = {
  name: 'curated-demo',
  mode: 'demo',
  async generateStructured(schema, _name, _prompt, mockValue) {
    return schema.parse(mockValue);
  },
  async generateAssessment(input) {
    const normTopic = input.topic.toLocaleLowerCase('kk');
    const entry = curated.find(item => normTopic.includes(item.keyword));
    const count = Math.min(Math.max(input.count || 3, 1), 20);
    const totalPoints = Math.max(input.totalPoints || 20, count);

    let rawQuestions: Array<{
      id: string;
      type: 'short' | 'single' | 'open' | 'practical';
      question: string;
      correctAnswer: string;
      points: number;
      criterion: string;
      descriptors: Array<{ text: string; points: number }>;
    }> = [];

    if (entry) {
      const base = Math.floor(totalPoints / count);
      rawQuestions = Array.from({ length: count }, (_, i) => {
        const points = i === count - 1 ? totalPoints - base * (count - 1) : base;
        const type: 'short' | 'open' | 'practical' = i === 0 ? 'short' : i % 2 === 0 ? 'open' : 'practical';
        return {
          id: `q-${i + 1}`,
          type,
          question: i === 0 ? entry.question : `${entry.question} Жауабыңызды мысалмен толықтырыңыз (${i + 1}-тапсырма).`,
          correctAnswer: entry.answer,
          points,
          criterion: entry.criterion,
          descriptors: [{ text: entry.descriptor, points }],
        };
      });
    } else {
      const base = Math.floor(totalPoints / count);
      const mainObj = input.objectives[0] || input.topic;
      rawQuestions = Array.from({ length: count }, (_, i) => {
        const points = i === count - 1 ? totalPoints - base * (count - 1) : base;
        const type: 'short' | 'single' | 'open' = i === 0 ? 'short' : i === 1 ? 'single' : 'open';
        const qText = i === 0
          ? `«${input.topic}» ұғымының негізгі мәнін түсіндіріңіз.`
          : i === 1
          ? `«${mainObj}» оқу мақсатына сай негізгі ереже мен әрекетті анықтаңыз.`
          : `«${input.topic}» тақырыбы бойынша практикалық мысал келтіріп, сипаттаңыз.`;
        return {
          id: `q-${i + 1}`,
          type,
          question: qText,
          correctAnswer: `«${input.topic}» бойынша негізгі дұрыс жауап және анықтама.`,
          points,
          criterion: `«${input.topic}» тақырыбының негізгі ұғымдарын меңгерген.`,
          descriptors: [{ text: `Тақырып бойынша сұраққа толық әрі дұрыс жауап береді`, points }],
        };
      });
    }

    const rawMockData = {
      title: input.title || `${input.topic} — бағалау тапсырмалары`,
      section: input.unit || input.section || 'Бөлім',
      unit: input.unit || input.section || 'Бөлім',
      topic: input.topic,
      objectives: input.objectives,
      criteria: input.criteria || [],
      questions: rawQuestions,
    };

    const normalized = normalizeAssessmentAIResponse(rawMockData, {
      title: rawMockData.title,
      topic: input.topic,
      unit: input.unit || input.section,
      objectives: input.objectives,
      criteria: input.criteria,
      totalPoints: input.totalPoints,
      count: input.count,
      grade: input.grade,
      subject: input.subject,
    });

    return {
      title: `${normalized.title} — демо нұсқа`,
      section: normalized.section,
      unit: normalized.unit,
      topic: normalized.topic,
      objectives: normalized.objectives,
      criteria: normalized.criteria,
      totalPoints: normalized.totalPoints,
      questions: normalized.questions,
      mode: 'demo',
    };
  },
  async generateLessonPlan() {
    return { text: 'Демо режимінде сабақ мазмұнын мұғалім өзі енгізеді.', mode: 'demo' };
  },
  async generateTest() {
    return { text: 'Демо режимінде тест тапсырмаларын мұғалім өзі енгізеді.', mode: 'demo' };
  },
  async generateFeedback() {
    return { text: 'Демо режимі: пікірді мұғалім жазады.', mode: 'demo' };
  },
  async generateInsight() {
    return { text: 'Демо режимі: ұсыныстар автоматты жасалмайды.', mode: 'demo' };
  },
};

class OpenAIProvider implements AIProvider {
  name = 'openai';
  mode = 'real' as const;

  constructor(private apiKey: string, private model: string) {}

  private get client() {
    if (!this.apiKey || !this.model) throw new Error('AI API key және model енгізілуі керек.');
    return new OpenAI({ apiKey: this.apiKey, timeout: 30000, maxRetries: 2 });
  }

  async generateStructured<T>(schema: z.ZodType<T>, name: string, prompt: string, mockValue: T): Promise<T> {
    const exampleValue = name === 'lesson_plan' && typeof mockValue === 'object' && mockValue !== null
      ? Object.fromEntries(Object.entries(mockValue).map(([key, value]) => ['start', 'middle', 'end'].includes(key) && value && typeof value === 'object'
        ? [key, Object.fromEntries(Object.entries(value).map(([field, item]) => [field, field === 'minutes' ? item : '']))]
        : [key, value]))
      : mockValue;
    const example = JSON.stringify(exampleValue);
    let correction = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      let response;
      try {
        response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Қазақ тілінде мұғалімге арналған оқу материалын жаса. Тек жарамды JSON объектісін қайтар. Үлгінің барлық өрістерін және олардың түрлерін сақта; мазмұнын сұранысқа сай жаңарт. Мәтін өрістерін бос қалдырма.',
            },
            { role: 'user', content: `${prompt}\n\nЖауап құрылымының үлгісі (мазмұнын көшірме): ${example}${correction}` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.4,
        });
      } catch (error) {
        throw mapAIError(error, this.model);
      }

      try {
        const parsed = cleanAndParseJson(response.choices[0]?.message?.content || '');
        const result = schema.safeParse(parsed);
        if (result.success) return result.data;
        const fields = result.error.issues.map(issue => issue.path.join('.') || 'жауап').join(', ');
        correction = `\n\nАлдыңғы жауапта мына өрістер жарамсыз немесе жоқ болды: ${fields}. Барлық өрісті үлгіге сай толтыр.`;
      } catch {
        correction = '\n\nАлдыңғы жауап JSON ретінде оқылмады. Толық жарамды JSON объектісін қайтар.';
      }
    }
    throw new Error('AI жауабы күтілген форматқа сай келмеді. Қайта көріңіз.');
  }

  async generateAssessment(input: AssessmentPrompt): Promise<GeneratedAssessment> {
    const prompt = `Қазақстан мектеп бағдарламасына сай бағалау тапсырмаларын құрастыр.
Пән: ${input.subject || 'Информатика'}
Сынып: ${input.grade}
Тоқсан: ${input.quarter || 1}
Бөлім: ${input.unit || input.section || 'Бөлім'}
Тақырып: ${input.topic}
Оқу мақсаттары: ${input.objectives.join('; ')}
${input.criteria?.length ? `Бағалау критерийлері: ${input.criteria.join('; ')}` : ''}
Қиындық деңгейі: ${input.difficulty || 'Орташа'}
Тапсырмалар саны: ${input.count}
Жалпы балл: ${input.totalPoints}

Міндетті түрде мына үлгідегі JSON форматында ғана қайтар:
{
  "title": "${input.title || `${input.topic} — бағалау`}",
  "section": "${input.unit || input.section || 'Бөлім'}",
  "topic": "${input.topic}",
  "objectives": ${JSON.stringify(input.objectives)},
  "criteria": ${JSON.stringify(input.criteria?.length ? input.criteria : ['Тақырып талаптарын дұрыс орындайды'])},
  "questions": [
    {
      "id": "q1",
      "type": "short",
      "question": "Сұрақ мәтіні",
      "correctAnswer": "Толық әрі нақты дұрыс жауап",
      "points": 2,
      "criterion": "Бағалау критерийі",
      "descriptors": [
        { "text": "1-дескриптор", "points": 1 },
        { "text": "2-дескриптор", "points": 1 }
      ]
    }
  ]
}

Талаптар:
1. Тек жарамды JSON қайтар. Markdown немесе басқа қосымша мәтін қоспа.
2. Тапсырмалар саны дәл ${input.count} болуы керек.
3. Барлық тапсырмалардың балдар қосындысы дәл ${input.totalPoints} балл болуы керек.
4. Әр тапсырмадағы дескрипторлар балдарының қосындысы сол тапсырманың балына дәл тең болуы керек.
5. Тапсырмалар қайталанбасын.`;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'Сен — Қазақстан мектеп стандарты (БЖБ/ТЖБ) бойынша бағалау тапсырмаларын құрастыратын білікті AI әдіскерсің. Тек жарамды JSON форматында жауап бересің.',
            },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('AI жауап бермеді.');
        }

        const normalized = normalizeAssessmentAIResponse(content, {
          title: input.title,
          topic: input.topic,
          unit: input.unit || input.section,
          objectives: input.objectives,
          criteria: input.criteria,
          totalPoints: input.totalPoints,
          count: input.count,
          grade: input.grade,
          subject: input.subject,
        });

        const validation = validateAssessment({
          title: normalized.title,
          quarter: input.quarter || 1,
          unit: normalized.unit,
          topic: normalized.topic,
          objectives: normalized.objectives,
          durationMinutes: input.durationMinutes || 40,
          difficulty: input.difficulty === 'Жеңіл' || input.difficulty === 'Күрделі' ? input.difficulty : 'Орташа',
          targetTotalPoints: input.totalPoints,
          questions: normalized.questions,
        });

        if (!validation.issues.length) {
          return {
            title: normalized.title,
            section: normalized.section,
            unit: normalized.unit,
            topic: normalized.topic,
            objectives: normalized.objectives,
            criteria: normalized.criteria,
            totalPoints: normalized.totalPoints,
            questions: normalized.questions,
            mode: 'real',
          };
        }
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status && status < 500 && status !== 429) throw mapAIError(err, this.model);
        if (attempt === 1) {
          throw mapAIError(err, this.model);
        }
      }
    }

    throw new Error('AI жасаған тапсырмалар талаптарға сай келмеді. Тақырып пен оқу мақсатын тексеріп, қайта көріңіз.');
  }

  async generateLessonPlan(prompt: string) {
    return {
      text: (await this.generateStructured(z.object({ text: z.string() }), 'lesson_plan', prompt, { text: '' })).text,
      mode: 'real' as const,
    };
  }

  async generateTest(prompt: string) {
    return {
      text: (await this.generateStructured(z.object({ text: z.string() }), 'test', prompt, { text: '' })).text,
      mode: 'real' as const,
    };
  }

  async generateFeedback(prompt: string) {
    return {
      text: (await this.generateStructured(z.object({ text: z.string() }), 'feedback', prompt, { text: '' })).text,
      mode: 'real' as const,
    };
  }

  async generateInsight(prompt: string) {
    return {
      text: (await this.generateStructured(z.object({ text: z.string() }), 'insight', prompt, { text: '' })).text,
      mode: 'real' as const,
    };
  }
}

export type AIRequestConfig = { provider?: string; apiKey?: string; model?: string };

export function getAIRequestConfig(request?: Request): Required<AIRequestConfig> {
  return {
    provider: request?.headers.get('x-ai-provider') || process.env.AI_PROVIDER || AI_CONFIG.provider,
    apiKey: request?.headers.get('x-ai-key') || process.env.AI_API_KEY || AI_CONFIG.apiKey,
    model: request?.headers.get('x-ai-model') || process.env.AI_MODEL || AI_CONFIG.model,
  };
}

export function getAIProvider(config: AIRequestConfig = {}): AIProvider {
  const resolved = {
    provider: config.provider || process.env.AI_PROVIDER || AI_CONFIG.provider,
    apiKey: config.apiKey || process.env.AI_API_KEY || AI_CONFIG.apiKey,
    model: config.model || process.env.AI_MODEL || AI_CONFIG.model,
  };
  if (resolved.provider === 'mock' || !resolved.apiKey) return mockProvider;
  if (resolved.provider === 'openai') return new OpenAIProvider(resolved.apiKey, resolved.model);
  throw new Error('AI provider мәні танылмады.');
}

export function mapAIError(error: unknown, model?: string) {
  if (error instanceof Error && (error.message.startsWith('[') || error.message.startsWith('{'))) {
    return new Error(formatZodError(error));
  }
  const value = error as { status?: number; code?: string; message?: string; type?: string };
  if (process.env.NODE_ENV === 'development') console.error('AI request failed', { status: value.status, type: value.type, code: value.code, message: value.message?.replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]'), target: 'api.openai.com', model: model || process.env.AI_MODEL || AI_CONFIG.model });
  if (value.status === 401) return new Error('API кілті жарамсыз. Кілтті тексеріңіз.');
  if (value.status === 403) return new Error('Бұл аккаунтқа AI сервисіне қолжетімділік берілмеген.');
  if (value.status === 404 || value.code === 'model_not_found') return new Error('Таңдалған AI моделі қолжетімсіз. Model атауын тексеріңіз.');
  if (value.code === 'invalid_value' && value.message?.toLowerCase().includes('image')) return new Error('Vision сурет файлын оқи алмады. Жарамды PNG немесе JPG таңдаңыз.');
  if (value.status === 429 || value.code === 'rate_limit_exceeded' || value.code === 'insufficient_quota') return new Error('AI сұраныс лимиті немесе баланс аяқталған.');
  if (value.status && value.status >= 500) return new Error('AI сервисі уақытша қолжетімсіз.');
  if (value.code === 'ETIMEDOUT' || value.message?.toLowerCase().includes('timeout')) return new Error('AI сұранысының күту уақыты аяқталды.');
  if (value.message?.toLowerCase().includes('fetch') || value.message?.toLowerCase().includes('network') || value.message?.toLowerCase().includes('connection')) {
    return new Error('AI сервисімен желілік байланыс орнатылмады.');
  }
  return new Error('AI сұранысы орындалмады. Қайта көріңіз.');
}

export async function recordAIRequest(userId: string, action: string, model: string, status: string, durationMs: number) {
  if (useDevStore) {
    await devWrite(db => {
      db.aiRequests ??= [];
      db.aiRequests.push({
        id: crypto.randomUUID(),
        userId,
        action,
        model,
        status,
        durationMs,
        createdAt: new Date().toISOString(),
      });
    });
    return;
  }
  await prisma.aIRequest.create({ data: { userId, action, model, status, durationMs } });
}
