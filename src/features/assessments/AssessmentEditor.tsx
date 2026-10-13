'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Save, Trash2, ClipboardList, Sparkles, Download, AlertCircle } from 'lucide-react';
import {
  assessmentDraftSchema,
  validateAssessment,
  formatZodError,
  type AssessmentDraft,
} from './schema';
import type { Assessment, AssessmentQuestion } from '@/features/workspace/data';
import { aiHeaders } from '@/lib/ai/browser-settings';

const labels: Record<AssessmentQuestion['type'], string> = {
  single: 'Бір жауапты таңдау',
  multiple: 'Бірнеше жауапты таңдау',
  true_false: 'Дұрыс / бұрыс',
  short: 'Қысқа жауап',
  open: 'Ашық жауап',
  matching: 'Сәйкестендіру',
  ordering: 'Реттеу',
  practical: 'Практикалық тапсырма',
};

function newQuestion(): AssessmentQuestion {
  return {
    id: crypto.randomUUID(),
    type: 'short',
    question: '',
    answer: '',
    points: 1,
    criterion: '',
    descriptors: [{ text: '', points: 1 }],
  };
}

export default function AssessmentEditor({
  initial,
  grade,
  subject = 'Информатика',
}: {
  initial: Assessment;
  grade: string;
  subject?: string;
}) {
  const [draft, setDraft] = useState<AssessmentDraft>({
    title: initial.title,
    quarter: initial.quarter ?? 1,
    unit: initial.unit ?? initial.section ?? '',
    topic: initial.topic ?? '',
    objectives: initial.objectives?.length ? initial.objectives : [''],
    criteria: initial.criteria?.length ? initial.criteria : [''],
    durationMinutes: initial.durationMinutes ?? 40,
    difficulty: (initial.difficulty as AssessmentDraft['difficulty']) ?? 'Орташа',
    questions: initial.questions?.length ? initial.questions : [newQuestion()],
  });

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const [aiCount, setAiCount] = useState(3);
  const [aiPoints, setAiPoints] = useState(initial.totalPoints || 20);

  const validation = validateAssessment(draft);

  function field<K extends keyof AssessmentDraft>(key: K, value: AssessmentDraft[K]) {
    setDraft(v => ({ ...v, [key]: value }));
    setSaved(false);
  }

  function question(index: number, changes: Partial<AssessmentQuestion>) {
    setDraft(v => ({
      ...v,
      questions: v.questions.map((q, i) => (i === index ? { ...q, ...changes } : q)),
    }));
    setSaved(false);
  }

  async function save() {
    setMessage('');
    const parsed = assessmentDraftSchema.safeParse(draft);
    if (!parsed.success) {
      setMessage(formatZodError(parsed.error));
      return;
    }
    if (validation.issues.length) {
      setMessage(validation.issues.join(' '));
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(`/api/assessments/${initial.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Сақтау мүмкін болмады.');
      }
      setSaved(true);
      setMessage('Жоба сақталды.');
    } catch (error) {
      setMessage(formatZodError(error));
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setMessage('');

    // Pre-validation checks with clear Kazakh messages
    const cleanTopic = (draft.topic || '').trim();
    if (!cleanTopic) {
      setMessage('Тақырыпты енгізіңіз.');
      return;
    }
    if (cleanTopic.length < 2) {
      setMessage('Тақырып кемінде 2 таңбадан тұруы керек.');
      return;
    }

    const cleanUnit = (draft.unit || '').trim();
    if (!cleanUnit) {
      setMessage('Бөлімді енгізіңіз.');
      return;
    }
    if (cleanUnit.length < 2) {
      setMessage('Бөлім атауы кемінде 2 таңбадан тұруы керек.');
      return;
    }

    const validObjectives = (draft.objectives || []).map(o => o.trim()).filter(Boolean);
    if (validObjectives.length === 0) {
      setMessage('Оқу мақсатын енгізіңіз.');
      return;
    }

    if (aiCount < 1 || aiCount > 20) {
      setMessage('Тапсырмалар санын 1 мен 20 аралығында көрсетіңіз.');
      return;
    }

    if (aiPoints < 1 || aiPoints > 100) {
      setMessage('Жалпы балды 1 мен 100 аралығында көрсетіңіз.');
      return;
    }

    const validCriteria = (draft.criteria || []).map(c => c.trim()).filter(Boolean);

    setBusy(true);
    try {
      const payload = {
        title: draft.title,
        subject,
        grade,
        quarter: draft.quarter,
        unit: cleanUnit,
        section: cleanUnit,
        topic: cleanTopic,
        objectives: validObjectives,
        criteria: validCriteria,
        count: aiCount,
        totalPoints: aiPoints,
        difficulty: draft.difficulty,
        durationMinutes: draft.durationMinutes,
      };

      const response = await fetch('/api/ai/assessment', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...aiHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Тапсырмаларды жасау мүмкін болмады.');
      }

      setDraft(v => ({
        ...v,
        title: result.title || v.title,
        unit: result.unit || result.section || v.unit,
        section: result.section || result.unit || v.unit,
        topic: result.topic || v.topic,
        objectives: result.objectives?.length ? result.objectives : v.objectives,
        criteria: result.criteria?.length ? result.criteria : v.criteria,
        questions: result.questions,
      }));
      setSaved(false);
      setMessage(
        result.mode === 'demo'
          ? 'Демо үлгісі жасалды. Барлық тапсырманы тексеріп, қажет болса өзгертіңіз.'
          : 'AI тапсырмалары дайын. Сақтар алдында тексеріңіз.'
      );
    } catch (error) {
      setMessage(formatZodError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="editor-shell">
      <div className="editor-top">
        <Link href="/assessments">
          <ArrowLeft size={18} /> Бағалауларға қайту
        </Link>
        <span className="assessment-badge">{initial.kind}</span>
      </div>

      <div className="editor-header">
        <div>
          <span className="eyebrow">БАҒАЛАУ ҚҰРАСТЫРҒЫШЫ — {grade} ({subject})</span>
          <h1>{draft.title}</h1>
          <p>Тапсырмаларды өзіңіз құрастырып, дескриптор балдарын тексеріңіз.</p>
        </div>
        <button className="primary" onClick={save} disabled={busy}>
          <Save size={17} />
          {busy ? 'Сақталуда...' : 'Жобаны сақтау'}
        </button>
      </div>

      <div className="ai-generator">
        <Sparkles size={20} />
        <div>
          <strong>AI арқылы тапсырма жасау</strong>
          <small>Пән, бөлім, тақырып және оқу мақсаттарына сай автоматты тапсырмалар дайындайды.</small>
        </div>
        <label>
          Сұрақ
          <input
            type="number"
            min={1}
            max={20}
            value={aiCount}
            onChange={e => setAiCount(Number(e.target.value))}
          />
        </label>
        <label>
          Балл
          <input
            type="number"
            min={1}
            max={100}
            value={aiPoints}
            onChange={e => setAiPoints(Number(e.target.value))}
          />
        </label>
        <button className="secondary" onClick={generate} disabled={busy}>
          {busy ? 'Жасалуда...' : 'Жасау'}
        </button>
      </div>

      {message && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 18,
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            background: saved ? '#e8f7ee' : '#fff3ec',
            color: saved ? '#378d68' : '#be6e50',
            border: `1px solid ${saved ? '#c6eed7' : '#f5ded0'}`,
          }}
        >
          <AlertCircle size={17} />
          <span>{message}</span>
        </div>
      )}

      <div className="editor-layout">
        <div className="editor-main">
          <section className="editor-panel">
            <h2>Негізгі мәліметтер</h2>
            <div className="builder-grid">
              <label>
                Атауы
                <input value={draft.title} onChange={e => field('title', e.target.value)} />
              </label>
              <label>
                Тоқсан
                <select value={draft.quarter} onChange={e => field('quarter', Number(e.target.value))}>
                  {[1, 2, 3, 4].map(q => (
                    <option key={q} value={q}>
                      {q}-тоқсан
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Бөлім
                <input
                  value={draft.unit}
                  placeholder="Мысалы: Программалау"
                  onChange={e => field('unit', e.target.value)}
                />
              </label>
              <label>
                Тақырып
                <input
                  value={draft.topic}
                  placeholder="Мысалы: Python негіздері"
                  onChange={e => field('topic', e.target.value)}
                />
              </label>
              <label>
                Ұзақтығы, минут
                <input
                  type="number"
                  min={1}
                  value={draft.durationMinutes}
                  onChange={e => field('durationMinutes', Number(e.target.value))}
                />
              </label>
              <label>
                Қиындық
                <select
                  value={draft.difficulty}
                  onChange={e => field('difficulty', e.target.value as AssessmentDraft['difficulty'])}
                >
                  <option>Жеңіл</option>
                  <option>Орташа</option>
                  <option>Күрделі</option>
                </select>
              </label>
            </div>

            <label>
              Оқу мақсаты (әр жолда бір мақсат)
              <textarea
                rows={2}
                placeholder="Мысалы: Python программасының негізгі құрылымын түсіну"
                value={(draft.objectives || []).join('\n')}
                onChange={e => field('objectives', e.target.value.split('\n'))}
              />
            </label>

            <label style={{ marginTop: 12 }}>
              Бағалау критерийлері (міндетті емес, әр жолда біреу)
              <textarea
                rows={2}
                placeholder="Мысалы: Python синтаксисін дұрыс қолданады"
                value={(draft.criteria || []).join('\n')}
                onChange={e => field('criteria', e.target.value.split('\n'))}
              />
            </label>
          </section>

          <div className="editor-section-head">
            <h2>
              Тапсырмалар <span>{draft.questions.length}</span>
            </h2>
            <button
              className="secondary"
              onClick={() => field('questions', [...draft.questions, newQuestion()])}
            >
              <Plus size={16} /> Тапсырма қосу
            </button>
          </div>

          {draft.questions.map((q, i) => (
            <section className="editor-panel question-panel" key={q.id}>
              <div className="question-head">
                <h3>{i + 1}-тапсырма</h3>
                <button
                  aria-label="Тапсырманы өшіру"
                  onClick={() => field('questions', draft.questions.filter((_, index) => index !== i))}
                >
                  <Trash2 size={17} />
                </button>
              </div>

              <div className="builder-grid">
                <label>
                  Түрі
                  <select
                    value={q.type}
                    onChange={e => question(i, { type: e.target.value as AssessmentQuestion['type'] })}
                  >
                    {Object.entries(labels).map(([key, label]) => (
                      <option value={key} key={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Балл
                  <input
                    type="number"
                    min={1}
                    value={q.points}
                    onChange={e => question(i, { points: Number(e.target.value) })}
                  />
                </label>
              </div>

              <label>
                Сұрақ мәтіні
                <textarea
                  rows={3}
                  value={q.question}
                  onChange={e => question(i, { question: e.target.value })}
                />
              </label>

              <label>
                Дұрыс жауап
                <textarea
                  rows={2}
                  value={q.answer}
                  onChange={e => question(i, { answer: e.target.value })}
                />
              </label>

              <label>
                Бағалау критерийі
                <input
                  value={q.criterion}
                  onChange={e => question(i, { criterion: e.target.value })}
                />
              </label>

              <div className="descriptor-head">Дескрипторлар</div>
              {q.descriptors.map((d, j) => (
                <div className="descriptor-row" key={j}>
                  <input
                    aria-label={`${j + 1}-дескриптор`}
                    value={d.text}
                    placeholder="Дескриптор мәтіні"
                    onChange={e =>
                      question(i, {
                        descriptors: q.descriptors.map((item, index) =>
                          index === j ? { ...item, text: e.target.value } : item
                        ),
                      })
                    }
                  />
                  <input
                    aria-label="Дескриптор балы"
                    type="number"
                    min={0}
                    value={d.points}
                    onChange={e =>
                      question(i, {
                        descriptors: q.descriptors.map((item, index) =>
                          index === j ? { ...item, points: Number(e.target.value) } : item
                        ),
                      })
                    }
                  />
                  <button
                    aria-label="Дескрипторды өшіру"
                    onClick={() =>
                      question(i, {
                        descriptors: q.descriptors.filter((_, index) => index !== j),
                      })
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}

              <button
                className="text-link"
                onClick={() =>
                  question(i, {
                    descriptors: [...q.descriptors, { text: '', points: 0 }],
                  })
                }
              >
                <Plus size={15} /> Дескриптор қосу
              </button>
            </section>
          ))}
        </div>

        <aside className="editor-summary">
          <ClipboardList size={21} />
          <h3>Бағалау қорытындысы</h3>
          <div>
            <span>Тапсырма</span>
            <strong>{draft.questions.length}</strong>
          </div>
          <div>
            <span>Жалпы балл</span>
            <strong>{validation.totalPoints}</strong>
          </div>
          <div>
            <span>Ұзақтығы</span>
            <strong>{draft.durationMinutes} мин</strong>
          </div>

          {validation.issues.length > 0 && (
            <div className="summary-warning">
              {validation.issues.map((issue, i) => (
                <p key={i}>{issue}</p>
              ))}
            </div>
          )}

          {message && (
            <p className={saved ? 'summary-success' : 'summary-warning'} role="status">
              {message}
            </p>
          )}

          <button className="primary" onClick={save} disabled={busy}>
            <Save size={16} /> Сақтау
          </button>

          {saved && (
            <div className="export-links">
              <a href={`/api/assessments/${initial.id}/export?variant=student`}>
                <Download size={15} /> Оқушыға Word
              </a>
              <a href={`/api/assessments/${initial.id}/export?variant=teacher`}>
                <Download size={15} /> Мұғалімге Word
              </a>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
