import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiHeaders } from './browser-settings';

afterEach(() => vi.unstubAllGlobals());

describe('browser AI settings', () => {
  it('uses the server key when no browser key is saved and removes old settings', () => {
    const values = new Map([['ustaz-ai-test-settings-v1', JSON.stringify({ provider: 'mock', apiKey: 'old-key' })]]);
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
    });

    const headers = aiHeaders();
    expect(headers['x-ai-provider']).toBe('openai');
    expect(headers).not.toHaveProperty('x-ai-key');
    expect(values.has('ustaz-ai-test-settings-v1')).toBe(false);
  });
});
