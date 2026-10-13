'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, KeyRound, ShieldAlert } from 'lucide-react';
import { defaultAISettings, type BrowserAISettings } from '@/config/ai.config';
import { aiHeaders, loadAISettings, saveAISettings } from '@/lib/ai/browser-settings';

type Status = 'unchecked' | 'real' | 'demo' | 'disconnected';

export default function AISettings() {
  const [value, setValue] = useState<BrowserAISettings>(defaultAISettings());
  const [status, setStatus] = useState<Status>('unchecked');
  const [message, setMessage] = useState('');
  const [visionMessage, setVisionMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [visionBusy, setVisionBusy] = useState(false);
  useEffect(() => setValue(loadAISettings()), []);
  const set = <K extends keyof BrowserAISettings>(key: K, next: BrowserAISettings[K]) => {
    setValue(current => ({ ...current, [key]: next }));
    setStatus('unchecked');
  };
  function save() {
    saveAISettings(value);
    setMessage(value.provider === 'mock' ? 'Демо AI режимі таңдалды.' : 'AI баптаулары сақталды. Байланысты тексеріңіз.');
    setStatus(value.provider === 'mock' ? 'demo' : 'unchecked');
  }
  async function check(path: string, vision: boolean) {
    saveAISettings(value);
    if (vision) { setVisionBusy(true); setVisionMessage(''); }
    else { setBusy(true); setMessage(''); }
    try {
      const response = await fetch(path, { method: 'POST', headers: aiHeaders() });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Байланысты тексеру мүмкін болмады.');
      if (vision) setVisionMessage(result.message);
      else { setMessage(result.message); setStatus(result.mode === 'real' ? 'real' : 'demo'); }
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Байланысты тексеру мүмкін болмады.';
      if (vision) setVisionMessage(text);
      else { setMessage(text); setStatus('disconnected'); }
    } finally {
      if (vision) setVisionBusy(false);
      else setBusy(false);
    }
  }
  const statusText = status === 'real' ? '● Нақты AI қосылған' : status === 'demo' ? '● Демо AI режимі' : status === 'disconnected' ? '● AI байланысы жоқ' : '● AI байланысы тексерілмеген';
  return <main className="editor-shell">
    <div className="editor-top"><Link href="/"><ArrowLeft size={18}/> Басты бетке қайту</Link><span className="assessment-badge">TEST MODE</span></div>
    <div className="editor-header"><div><span className="eyebrow">AI БАПТАУЛАРЫ</span><h1>AI және Vision сервисі</h1><p>Браузердегі кілт сервер кілтінен басым. Барлық сұрау сервер арқылы өтеді.</p></div></div>
    <div className="info-banner"><ShieldAlert size={18}/><span>Бұл тест нұсқа. Браузерге енгізілген API key қауіпсіз сақталмайды; сервер кілтін қолдану үшін өрісті бос қалдырыңыз.</span></div>
    <section className="editor-panel" style={{ maxWidth: 760 }}>
      <h2><KeyRound size={17}/> Негізгі AI</h2>
      <p aria-live="polite">{statusText}</p>
      <div className="builder-grid"><label>Provider<select value={value.provider} onChange={event => set('provider', event.target.value as BrowserAISettings['provider'])}><option value="mock">Mock AI</option><option value="openai">OpenAI</option></select></label><label>Model<input value={value.model} onChange={event => set('model', event.target.value)} placeholder="gpt-4o-mini"/></label></div>
      <label>API key<input type="password" autoComplete="off" value={value.apiKey} onChange={event => set('apiKey', event.target.value)} placeholder="Сервер кілтін қолдану үшін бос қалдырыңыз"/></label>
      <h2 style={{ marginTop: 28 }}>Vision / OCR</h2>
      <div className="builder-grid"><label>OCR Provider<select value={value.ocrProvider} onChange={event => set('ocrProvider', event.target.value as BrowserAISettings['ocrProvider'])}><option value="mock">Mock OCR</option><option value="openai">OpenAI Vision</option></select></label><label>Vision model<input value={value.visionModel} onChange={event => set('visionModel', event.target.value)}/></label></div>
      <label>Бөлек OCR key (міндетті емес)<input type="password" autoComplete="off" value={value.ocrApiKey} onChange={event => set('ocrApiKey', event.target.value)} placeholder="Бос болса негізгі AI key қолданылады"/></label>
      <div className="modal-actions" style={{ justifyContent: 'flex-start' }}><button className="primary" onClick={save}><CheckCircle2 size={16}/> Сақтау</button><button className="secondary" onClick={() => void check('/api/ai/test', false)} disabled={busy}>{busy ? 'Тексерілуде…' : 'Байланысты тексеру'}</button><button className="secondary" onClick={() => void check('/api/ai/vision-test', true)} disabled={visionBusy}>{visionBusy ? 'Тексерілуде…' : 'Vision-ды тексеру'}</button></div>
      {message && <div className={status === 'real' || status === 'demo' ? 'summary-success' : 'summary-warning'} style={{ marginTop: 16 }} role="status">{message}</div>}
      {visionMessage && <div className={visionMessage.includes('сәтті') ? 'summary-success' : 'summary-warning'} style={{ marginTop: 16 }} role="status">{visionMessage}</div>}
    </section>
  </main>;
}
