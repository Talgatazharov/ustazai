import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/client', () => ({ useDevStore: true, prisma: {} }));
vi.mock('@/lib/db/dev-store', () => ({ devWrite: vi.fn() }));

import { generatedAssessmentSchema, mapAIError, getAIProvider, getAIRequestConfig } from './provider';
import { getOCRRequestConfig } from '@/lib/ocr/provider';
import { AI_CONFIG } from '@/config/ai.config';

describe('AI structured output', () => {
  it('uses central OCR provider and vision model settings', () => {
    const config = getOCRRequestConfig();
    expect(config.provider).toBe(AI_CONFIG.ocrProvider);
    expect(config.model).toBe(AI_CONFIG.visionModel);
  });

  it('uses server configuration when the browser sends no key', () => {
    const config = getAIRequestConfig(new Request('http://localhost/api/ai/test', {
      headers: { 'x-ai-provider': 'openai' },
    }));
    expect(config.provider).toBe('openai');
    expect(config.model).toBe(AI_CONFIG.model);
    expect(config.apiKey).toBe(process.env.AI_API_KEY || AI_CONFIG.apiKey);
  });
  it('prefers the Settings key and model over server configuration', () => {
    const config = getAIRequestConfig(new Request('http://localhost/api/ai/test', {
      headers: { 'x-ai-provider': 'openai', 'x-ai-key': 'settings-key', 'x-ai-model': 'settings-model' },
    }));
    expect(config.apiKey).toBe('settings-key');
    expect(config.model).toBe('settings-model');
    expect(getAIProvider(config).mode).toBe('real');
  });
  it('rejects malformed assessment JSON', () => {
    expect(
      generatedAssessmentSchema.safeParse({ title: 'Тест', questions: [{ type: 'unknown' }] }).success
    ).toBe(false);
  });

  it('accepts complete descriptor data', () => {
    expect(
      generatedAssessmentSchema.safeParse({
        title: 'Тест',
        questions: [
          {
            type: 'short',
            question: 'Сұрақ',
            answer: 'Жауап',
            points: 2,
            criterion: 'Критерий',
            descriptors: [{ text: 'Дескриптор', points: 2 }],
          },
        ],
      }).success
    ).toBe(true);
  });

  it('maps service errors to Kazakh messages', () => {
    expect(mapAIError({ status: 401 }).message).toContain('кілт');
    expect(mapAIError({ status: 429 }).message).toContain('лимит');
    expect(mapAIError({ status: 404, code: 'model_not_found' }).message).toContain('моделі');
    expect(mapAIError({ message: 'Connection error.' }).message).toContain('желілік');
  });

  it('generates assessments in mock mode without throwing for any topic', async () => {
    const provider = getAIProvider({ provider: 'mock' });
    const result = await provider.generateAssessment({
      title: 'Python негіздері',
      grade: '8-сынып',
      quarter: 1,
      unit: 'Программалау',
      topic: 'Python негіздері',
      objectives: ['Python командаларын қолдану'],
      count: 2,
      totalPoints: 10,
    });

    expect(result.questions).toHaveLength(2);
    expect(result.totalPoints).toBe(10);
    expect(result.mode).toBe('demo');

    // Also test non-curated topic
    const dynamicResult = await provider.generateAssessment({
      title: 'Деректер қоры',
      grade: '9-сынып',
      quarter: 2,
      unit: 'Ақпараттық жүйелер',
      topic: 'SQL сұраныстары',
      objectives: ['SELECT командасын қолдану'],
      count: 3,
      totalPoints: 15,
    });

    expect(dynamicResult.questions).toHaveLength(3);
    expect(dynamicResult.totalPoints).toBe(15);
  });
});
