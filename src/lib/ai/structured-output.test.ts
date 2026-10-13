import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const create = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/client', () => ({ useDevStore: true, prisma: {} }));
vi.mock('@/lib/db/dev-store', () => ({ devWrite: vi.fn() }));
vi.mock('openai', () => ({ default: class { chat = { completions: { create } }; } }));

import { getAIProvider } from './provider';

const answerSchema = z.object({ answer: z.string().min(1), suggestedActions: z.array(z.string()).max(3) });
const example = { answer: 'Үлгі жауап', suggestedActions: [] };

beforeEach(() => create.mockReset());

describe('real AI structured output', () => {
  it('retries a JSON object with missing fields and returns the corrected answer', async () => {
    create.mockResolvedValueOnce({ choices: [{ message: { content: '{"text":"қате"}' } }] });
    create.mockResolvedValueOnce({ choices: [{ message: { content: '{"answer":"Нақты жауап","suggestedActions":[]}' } }] });

    const provider = getAIProvider({ provider: 'openai', apiKey: 'test-key', model: 'test-model' });
    await expect(provider.generateStructured(answerSchema, 'copilot', 'Сұрақ', example))
      .resolves.toEqual({ answer: 'Нақты жауап', suggestedActions: [] });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].messages[1].content).toContain('suggestedActions');
  });

  it('shows a clear error after two malformed answers', async () => {
    create.mockResolvedValue({ choices: [{ message: { content: '{"text":"қате"}' } }] });
    const provider = getAIProvider({ provider: 'openai', apiKey: 'test-key', model: 'test-model' });
    await expect(provider.generateStructured(answerSchema, 'copilot', 'Сұрақ', example))
      .rejects.toThrow('AI жауабы күтілген форматқа сай келмеді');
  });
});
