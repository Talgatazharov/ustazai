'use client';

import { AI_CONFIG, AI_SETTINGS_KEY, defaultAISettings, type BrowserAISettings } from '@/config/ai.config';

export function loadAISettings(): BrowserAISettings {
  if (typeof window === 'undefined') return defaultAISettings();
  try {
    // Discard the old browser copy of the key and stale provider selection.
    localStorage.removeItem('ustaz-ai-test-settings-v1');
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    const defaults = defaultAISettings();
    if (!raw) return defaults;
    const stored = JSON.parse(raw);
    return {
      provider: stored.provider || defaults.provider,
      apiKey: stored.apiKey || defaults.apiKey,
      model: stored.model || defaults.model,
      ocrProvider: stored.ocrProvider || defaults.ocrProvider,
      ocrApiKey: stored.ocrApiKey || defaults.ocrApiKey,
      visionModel: stored.visionModel || defaults.visionModel,
    };
  } catch {
    return defaultAISettings();
  }
}

export function saveAISettings(value: BrowserAISettings) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(value));
  }
}

export function aiHeaders(): Record<string, string> {
  const value = loadAISettings();
  return {
    'x-ai-provider': value.provider,
    ...(value.apiKey ? { 'x-ai-key': value.apiKey.trim() } : {}),
    'x-ai-model': value.model || AI_CONFIG.model,
    'x-ocr-provider': value.ocrProvider,
    ...(value.ocrApiKey || value.apiKey ? { 'x-ocr-key': (value.ocrApiKey || value.apiKey).trim() } : {}),
    'x-vision-model': value.visionModel || AI_CONFIG.visionModel,
  };
}
