import { describe, expect, it } from 'vitest';
import { confidenceBand } from './types';
describe('confidence bands',()=>{it('uses configurable review threshold',()=>{expect(confidenceBand(69)).toBe('Тексеру қажет');expect(confidenceBand(70)).toBe('Орташа сенімділік');expect(confidenceBand(90)).toBe('Жоғары сенімділік');expect(confidenceBand(79,80)).toBe('Тексеру қажет');});});
