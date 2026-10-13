/**
 * ============================================================================
 * USTAZ AI — TEST / DEMO MODE CONFIGURATION
 * ============================================================================
 * ЕСКЕРТУ (WARNING):
 * Бұл TEST MODE нұсқасы. Frontend немесе client-side арқылы API кілттерді
 * қолдану тек локалды тестілеуге арналған және production үшін қауіпсіз емес.
 * Production кезінде барлық API шақырулары backend proxy арқылы орындалады.
 * ============================================================================
 */

export const AI_CONFIG = {
  /** Тест режимі белгісі */
  testMode: true,

  /** AI Провайдері: 'mock' немесе 'openai'. */
  provider: 'openai' as 'mock' | 'openai',

  /**
   * 1. Негізгі AI API KEY (OpenAI API кілті)
   * Мысалы: "sk-proj-..."
   * Бос қалдырсаңыз, жүйе Demo / Mock AI режимінде жұмыс істейді.
   */
  apiKey: '',

  /**
   * 2. Қолданылатын негізгі AI моделі
   * Мысалы: 'gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'
   */
  model: 'gpt-4o-mini',

  /**
   * 3. Vision / OCR провайдері: 'mock' немесе 'openai'
   */
  ocrProvider: 'openai' as 'mock' | 'openai',

  /**
   * 4. OCR / Vision үшін бөлек кілт (міндетті емес)
   * Бос болса — жоғарыдағы негізгі apiKey қолданылады.
   */
  ocrApiKey: '',

  /**
   * 5. Vision моделі (суреттегі қолжазба мен мәтінді тану үшін)
   */
  visionModel: 'gpt-4o-mini',
} as const;

export type BrowserAISettings = {
  provider: 'mock' | 'openai';
  apiKey: string;
  model: string;
  ocrProvider: 'mock' | 'openai';
  ocrApiKey: string;
  visionModel: string;
};

export const AI_SETTINGS_KEY = 'ustaz-ai-test-settings-v2';

export function defaultAISettings(): BrowserAISettings {
  return {
    provider: AI_CONFIG.provider,
    apiKey: AI_CONFIG.apiKey,
    model: AI_CONFIG.model,
    ocrProvider: AI_CONFIG.ocrProvider,
    ocrApiKey: AI_CONFIG.ocrApiKey,
    visionModel: AI_CONFIG.visionModel,
  };
}
