'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChartNoAxesCombined, Sparkles, TriangleAlert } from 'lucide-react';
import type { WorkspaceData } from '@/features/workspace/data';
import type { Analytics } from './calculate';
import { aiHeaders } from '@/lib/ai/browser-settings';

type AIInsight = {
  fact: string;
  recommendation: string;
};

type AIAnalyticsData = {
  insights: AIInsight[];
  summary: string;
};

export default function AnalyticsPageClient() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [classId, setClassId] = useState('');
  const [error, setError] = useState('');
  const [aiData, setAiData] = useState<AIAnalyticsData | null>(null);
  const [aiMode, setAiMode] = useState<'demo' | 'real' | ''>('');
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    void fetch('/api/workspace')
      .then(r => r.json())
      .then(v => setWorkspace(v.data))
      .catch(() => setError('Деректерді жүктеу мүмкін болмады.'));
  }, []);

  useEffect(() => {
    setAiData(null);
    void fetch(`/api/analytics${classId ? `?classId=${encodeURIComponent(classId)}` : ''}`)
      .then(r => r.json())
      .then(v => {
        if (v.error) throw new Error(v.error);
        setAnalytics(v.analytics);
      })
      .catch(e => setError(e.message));
  }, [classId]);

  async function generateAIAnalytics() {
    setAiBusy(true);
    setError('');
    try {
      const response = await fetch('/api/ai/analytics', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...aiHeaders(),
        },
        body: JSON.stringify({ classId: classId || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'AI талдауы жасалмады.');
      setAiData(result.data);
      setAiMode(result.mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI талдауы жасалмады.');
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <main className="analytics-shell">
      <Link href="/" className="back-link">
        <ArrowLeft size={18} /> Басты бетке қайту
      </Link>

      <div className="page-header">
        <div>
          <span className="eyebrow">НӘТИЖЕЛЕР МЕН ДИНАМИКА</span>
          <h1>Аналитика және үлгерім</h1>
          <p>Тек мұғалім бекіткен ресми жұмыстар есепке алынады.</p>
        </div>
        <select value={classId} onChange={e => setClassId(e.target.value)}>
          <option value="">Барлық сынып</option>
          {workspace?.classes.map(c => (
            <option value={c.id} key={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="form-error">{error}</div>}

      {!analytics && (
        <div className="loading-panel">
          <div className="loading-line" />
        </div>
      )}

      {analytics && (
        <>
          <div className="analytics-stats">
            <div>
              <small>БЕКІТІЛГЕН ЖҰМЫС</small>
              <strong>{analytics.count}</strong>
            </div>
            <div>
              <small>ОРТАША ПАЙЫЗ</small>
              <strong>{analytics.average}%</strong>
            </div>
            <div>
              <small>ОРТАША БАЛЛ</small>
              <strong>{analytics.averageScore} б.</strong>
            </div>
            <div>
              <small>ЕҢ ЖОҒАРЫ / ТӨМЕН</small>
              <strong>{analytics.highest}% / {analytics.lowest}%</strong>
            </div>
            <div>
              <small>СӘТТІ ӨТУ ҮЛЕСІ (≥60%)</small>
              <strong>{analytics.successRate}%</strong>
            </div>
          </div>

          {analytics.count === 0 ? (
            <div className="empty">
              <ChartNoAxesCombined size={30} />
              <strong>Әзірге бекітілген жұмыс жоқ</strong>
              <span>Нәтижелер жұмысты тексеріп, бекіткеннен кейін шығады.</span>
            </div>
          ) : (
            <>
              {/* AI Analytics Section */}
              <section className="editor-panel" style={{ marginTop: 24, marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                      <Sparkles size={20} color="#2563eb" /> AI Аналитикасы мен Әдістемелік ұсыныстары
                    </h2>
                    <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: 14 }}>
                      Нақты сандық фактілер мен педагогикалық ұсыныстардың қатаң бөлінуі.
                    </p>
                  </div>
                  <button
                    className="primary"
                    disabled={aiBusy}
                    onClick={() => void generateAIAnalytics()}
                  >
                    <Sparkles size={16} /> {aiBusy ? 'Талдануда…' : (aiData ? 'Талдауды жаңарту' : 'AI талдауын жасау')}
                  </button>
                </div>

                {aiData && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <span className="assessment-badge">{aiMode === 'demo' ? 'Демо AI режимі' : 'Real AI'}</span>
                      <p style={{ margin: 0, fontWeight: 500 }}>{aiData.summary}</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                      {aiData.insights.map((item, index) => (
                        <div
                          key={index}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: 12,
                            padding: 16,
                            background: '#f8fafc',
                          }}
                        >
                          <div style={{ marginBottom: 10 }}>
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                                color: '#0369a1',
                                background: '#e0f2fe',
                                padding: '2px 8px',
                                borderRadius: 6,
                                marginBottom: 6,
                              }}
                            >
                              ФАКТ:
                            </span>
                            <strong style={{ display: 'block', fontSize: 15, color: '#0f172a' }}>
                              {item.fact}
                            </strong>
                          </div>

                          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                            <span
                              style={{
                                display: 'inline-block',
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                                color: '#15803d',
                                background: '#dcfce7',
                                padding: '2px 8px',
                                borderRadius: 6,
                                marginBottom: 6,
                              }}
                            >
                              AI ҰСЫНЫСЫ:
                            </span>
                            <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.5 }}>
                              {item.recommendation}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Charts Grid */}
              <div className="analytics-grid">
                <section className="panel">
                  <h3>Балл таралуы</h3>
                  {analytics.distribution.map(item => (
                    <div className="chart-row" key={item.label}>
                      <span>{item.label}</span>
                      <div>
                        <i style={{ width: `${analytics.count ? (100 * item.count) / analytics.count : 0}%` }} />
                      </div>
                      <strong>{item.count} жұмыс</strong>
                    </div>
                  ))}
                </section>

                <section className="panel">
                  <h3>Үлгерім динамикасы</h3>
                  {analytics.dynamics.slice(-8).map(item => (
                    <div className="chart-row" key={item.label}>
                      <span>{item.label}</span>
                      <div>
                        <i style={{ width: `${item.percentage}%` }} />
                      </div>
                      <strong>{item.percentage}%</strong>
                    </div>
                  ))}
                </section>

                <section className="panel">
                  <h3>Тақырып бойынша меңгеру</h3>
                  {analytics.topicMastery.map(item => (
                    <div className="chart-row" key={item.topic}>
                      <span>{item.topic}</span>
                      <div>
                        <i style={{ width: `${item.percentage}%` }} />
                      </div>
                      <strong>{item.percentage}%</strong>
                    </div>
                  ))}
                </section>

                <section className="panel">
                  <h3>Критерий бойынша меңгеру</h3>
                  {analytics.criterionMastery.map(item => (
                    <div className="chart-row" key={item.criterion}>
                      <span>{item.criterion}</span>
                      <div>
                        <i style={{ width: `${item.percentage}%` }} />
                      </div>
                      <strong>{item.percentage}%</strong>
                    </div>
                  ))}
                </section>

                <section className="panel">
                  <h3>Дескриптор бойынша меңгеру</h3>
                  {analytics.descriptorMastery.map(item => (
                    <div className="chart-row" key={item.descriptor}>
                      <span>{item.descriptor}</span>
                      <div>
                        <i style={{ width: `${item.percentage}%` }} />
                      </div>
                      <strong>{item.percentage}%</strong>
                    </div>
                  ))}
                </section>

                <section className="panel">
                  <h3>Бағалауларды салыстыру</h3>
                  {analytics.assessmentComparison.map(item => (
                    <div className="chart-row" key={item.assessmentId}>
                      <span>{item.title}</span>
                      <div>
                        <i style={{ width: `${item.average}%` }} />
                      </div>
                      <strong>{item.average}%</strong>
                    </div>
                  ))}
                </section>

                <section className="panel" style={{ gridColumn: '1 / -1' }}>
                  <h3>Оқушылардың бекітілген нәтижелері</h3>
                  {analytics.studentProgress.map(item => (
                    <div className="chart-row" key={item.studentId}>
                      <span>{item.name}</span>
                      <div>
                        <i style={{ width: `${item.average}%` }} />
                      </div>
                      <strong>{item.average}% ({item.count} жұмыс)</strong>
                    </div>
                  ))}
                </section>
              </div>
            </>
          )}

          {analytics.alerts.length > 0 && (
            <section className="alert-panel" style={{ marginTop: 20 }}>
              <h3>
                <TriangleAlert size={17} /> Назар аударуды қажет ететін жайттар
              </h3>
              {analytics.alerts.map((a, i) => (
                <p key={i}>{a.text}</p>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
