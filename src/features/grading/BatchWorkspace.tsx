'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileUp, RotateCcw, ExternalLink } from 'lucide-react';
import type { WorkspaceData } from '@/features/workspace/data';
import { matchStudent } from './matching';
import { aiHeaders } from '@/lib/ai/browser-settings';

type BatchItem = {
  file: File;
  studentId: string;
  studentName: string;
  status: 'Кезекте' | 'Өңделуде' | 'Дайын' | 'Тексеру қажет' | 'Қате';
  score?: number;
  maxScore?: number;
  recordId?: string;
  error?: string;
};

export default function BatchWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceData>({ classes: [], students: [], assessments: [], documents: [] });
  const [classId, setClassId] = useState('');
  const [assessmentId, setAssessmentId] = useState('');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    void fetch('/api/workspace')
      .then(r => r.json())
      .then(v => {
        setWorkspace(v.data);
        setClassId(v.data.classes[0]?.id || '');
      });
  }, []);

  const students = workspace.students.filter(s => s.classId === classId);
  const assessments = workspace.assessments.filter(a => a.classId === classId);
  const selectedAssessment = assessments.some(a => a.id === assessmentId) ? assessmentId : assessments[0]?.id || '';

  function addFiles(files: FileList | null) {
    if (!files) return;
    const newItems: BatchItem[] = Array.from(files).map(file => {
      const match = matchStudent(file.name, students);
      const studentObj = students.find(s => s.id === match.studentId);
      return {
        file,
        studentId: match.studentId || '',
        studentName: studentObj ? studentObj.name : '',
        status: 'Кезекте',
      };
    });
    setItems(newItems);
    setDone(0);
  }

  function update(index: number, changes: Partial<BatchItem>) {
    setItems(v => v.map((item, i) => i === index ? { ...item, ...changes } : item));
  }

  async function process(indexes?: number[]) {
    if (!selectedAssessment) return;
    const targets = indexes ?? items.map((_, i) => i);
    setBusy(true);

    let processedCount = done;

    for (const index of targets) {
      const item = items[index];
      if (!item.studentId) {
        update(index, { status: 'Қате', error: 'Оқушыны таңдаңыз.' });
        processedCount = Math.min(items.length, processedCount + 1);
        setDone(processedCount);
        continue;
      }

      update(index, { status: 'Өңделуде', error: undefined });

      try {
        const form = new FormData();
        form.append('assessmentId', selectedAssessment);
        form.append('studentId', item.studentId);
        form.append('file', item.file);

        const response = await fetch('/api/grading', {
          method: 'POST',
          headers: aiHeaders(),
          body: form,
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Файл өңделмеді.');

        const record = result.record;
        const needsReview = record.ocrConfidence < 70 || record.items.some((it: { needsReview: boolean }) => it.needsReview);
        const displayStatus = needsReview ? 'Тексеру қажет' : 'Дайын';

        update(index, {
          status: displayStatus,
          score: record.aiScore,
          maxScore: record.maxScore,
          recordId: record.id,
          error: undefined,
        });
      } catch (error) {
        update(index, {
          status: 'Қате',
          error: error instanceof Error ? error.message : 'Файл өңделмеді.',
        });
      }

      processedCount = Math.min(items.length, processedCount + 1);
      setDone(processedCount);
    }

    setBusy(false);
  }

  const progressPercent = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <main className="grading-shell">
      <div className="grading-top">
        <Link href="/grading">
          <ArrowLeft size={18} /> Тексеру бөліміне қайту
        </Link>
        <span className="eyebrow">ЖАППАЙ ТЕКСЕРУ</span>
      </div>

      <div className="editor-header">
        <div>
          <h1>Бірнеше жұмысты жаппай тексеру</h1>
          <p>20–30 оқушы жұмысын бірден жүктеп, нәтижелерін топтама түрінде өңдеңіз. Бір файл қате болса, қалғандары тоқтамайды.</p>
        </div>
      </div>

      <div className="grading-upload">
        <div className="grading-fields">
          <label>
            Сынып
            <select
              value={classId}
              onChange={e => {
                setClassId(e.target.value);
                setAssessmentId('');
                setItems([]);
              }}
            >
              {workspace.classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <label>
            БЖБ / ТЖБ
            <select
              value={selectedAssessment}
              onChange={e => setAssessmentId(e.target.value)}
            >
              {assessments.map(a => (
                <option key={a.id} value={a.id}>{a.kind} · {a.title}</option>
              ))}
            </select>
          </label>

          <label>
            «Жұмыстарды жүктеу» (көп файл таңдаңыз)
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.png,.jpg,.jpeg"
              onChange={e => addFiles(e.target.files)}
            />
          </label>
        </div>

        <button
          className="primary"
          disabled={busy || !items.length}
          onClick={() => void process()}
        >
          <FileUp size={16} /> {busy ? 'Өңделуде...' : 'Жаппай тексеруді бастау'}
        </button>
      </div>

      {items.length > 0 && (
        <div className="grading-list">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2>
              {items.length} жұмыс — {done} / {items.length} өңделді ({progressPercent}%)
            </h2>
          </div>

          <div style={{ width: '100%', height: 8, backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: '#2563eb', transition: 'width 0.3s' }} />
          </div>

          {items.map((item, i) => {
            const num = i + 1;
            const displayName = item.studentName || students.find(s => s.id === item.studentId)?.name;
            const scoreText = item.score !== undefined && item.maxScore !== undefined ? `${item.score}/${item.maxScore} — ` : '';

            return (
              <div className="batch-row" key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ minWidth: 28, fontWeight: 700, color: '#64748b' }}>{num}.</span>

                <div style={{ flex: 1 }}>
                  <strong>
                    {displayName ? `${displayName} — ${scoreText}${item.status}` : `${item.file.name} — ${item.status}`}
                  </strong>
                  <small style={{ display: 'block', color: '#64748b' }}>
                    {item.file.name} {item.error ? `· Қате: ${item.error}` : ''}
                  </small>
                </div>

                {!item.studentId && (
                  <select
                    aria-label="Оқушыны таңдау"
                    value={item.studentId}
                    onChange={e => {
                      const sid = e.target.value;
                      const sObj = students.find(s => s.id === sid);
                      update(i, { studentId: sid, studentName: sObj?.name || '', status: 'Кезекте', error: undefined });
                    }}
                    style={{ maxWidth: 220 }}
                  >
                    <option value="">Оқушыны таңдаңыз</option>
                    {students.map(s => (
                      <option value={s.id} key={s.id}>{s.name}</option>
                    ))}
                  </select>
                )}

                <span
                  className={`grade-status ${
                    item.status === 'Дайын'
                      ? 'approved'
                      : item.status === 'Тексеру қажет'
                      ? 'warning'
                      : item.status === 'Қате'
                      ? 'failed'
                      : ''
                  }`}
                >
                  {item.status}
                </span>

                {item.status === 'Қате' && (
                  <button aria-label="Қайта жіберу" disabled={busy} onClick={() => void process([i])}>
                    <RotateCcw size={16} />
                  </button>
                )}

                {item.recordId && (
                  <Link
                    href={`/grading`}
                    className="text-link"
                    title="Тексеруге ашу"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    Ашу <ExternalLink size={14} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
