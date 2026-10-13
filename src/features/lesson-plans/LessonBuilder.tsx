'use client';

import { useState } from 'react';
import { Download, FileText, Sparkles, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import type { LessonContent } from '@/lib/documents/lesson-template';
import { aiHeaders } from '@/lib/ai/browser-settings';

const emptyStage = { minutes: 0, teacher: '', student: '', assessment: '', resources: '' };

export default function LessonBuilder({ teacher }: { teacher: string }) {
  const [content, setContent] = useState<LessonContent>({
    teacher,
    subject: 'Информатика',
    grade: '7А',
    date: new Date().toLocaleDateString('kk-KZ'),
    lessonType: 'Аралас сабақ',
    unit: '',
    topic: '',
    learningObjectives: '',
    lessonObjectives: '',
    duration: 45,
    attendance: '',
    start: { ...emptyStage, minutes: 5 },
    middle: { ...emptyStage, minutes: 35 },
    end: { ...emptyStage, minutes: 5 },
  });

  const [objectivesMode, setObjectivesMode] = useState<'ai' | 'manual'>('ai');
  const [customInstruction, setCustomInstruction] = useState('');
  const [busySection, setBusySection] = useState<'all' | 'start' | 'middle' | 'end' | 'download' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const total = content.start.minutes + content.middle.minutes + content.end.minutes;

  function field(key: keyof LessonContent, value: string | number) {
    setContent(v => ({ ...v, [key]: value }));
  }

  function stage(key: 'start' | 'middle' | 'end', fieldName: keyof LessonContent['start'], value: string | number) {
    setContent(v => ({ ...v, [key]: { ...v[key], [fieldName]: value } }));
  }

  function balanceDuration() {
    const s = Math.max(1, Math.round(content.duration * 0.12));
    const e = Math.max(1, Math.round(content.duration * 0.12));
    const m = content.duration - s - e;
    setContent(v => ({
      ...v,
      start: { ...v.start, minutes: s },
      middle: { ...v.middle, minutes: m },
      end: { ...v.end, minutes: e },
    }));
  }

  async function generate(section: 'all' | 'start' | 'middle' | 'end' = 'all') {
    setError('');
    setSuccess('');

    // Kazakh validations
    const cleanTopic = content.topic.trim();
    if (!cleanTopic) {
      setError('Сабақтың тақырыбын енгізіңіз.');
      return;
    }
    const cleanLearning = content.learningObjectives.trim();
    if (!cleanLearning) {
      setError('Оқу мақсатын енгізіңіз.');
      return;
    }
    const cleanUnit = content.unit.trim();
    if (!cleanUnit) {
      setError('Бөлімді енгізіңіз.');
      return;
    }
    if (!content.subject.trim()) {
      setError('Пәнді енгізіңіз.');
      return;
    }
    if (!content.grade.trim()) {
      setError('Сыныпты енгізіңіз.');
      return;
    }
    if (objectivesMode === 'manual' && !content.lessonObjectives.trim()) {
      setError('Сабақ мақсатын енгізіңіз немесе «AI жасасын» режимін таңдаңыз.');
      return;
    }

    setBusySection(section);
    try {
      const payload = {
        ...content,
        topic: cleanTopic,
        unit: cleanUnit,
        learningObjectives: cleanLearning,
        aiGenerateObjectives: objectivesMode === 'ai',
        customInstruction: customInstruction.trim(),
        regenerateSection: section,
      };

      const response = await fetch('/api/ai/lesson-plan', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...aiHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'ҚМЖ мазмұны жасалмады.');
      }

      setContent(result.data);
      if (objectivesMode === 'ai' && result.data.lessonObjectives) {
        // Updated objectives received
      }
      setSuccess(
        result.mode === 'demo'
          ? section === 'all'
            ? 'Демо ҚМЖ үлгісі дайын. Әр кезеңді қарап шығып, қажетінше өңдеңіз.'
            : `${section === 'start' ? 'Басы' : section === 'middle' ? 'Ортасы' : 'Соңы'} қайта жасалды (демо).`
          : section === 'all'
          ? 'AI арқылы ҚМЖ сәтті жасалды!'
          : `${section === 'start' ? 'Басы' : section === 'middle' ? 'Ортасы' : 'Соңы'} AI арқылы қайта жасалды!`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ҚМЖ жасау кезінде қате орын алды.');
    } finally {
      setBusySection(null);
    }
  }

  async function download() {
    setError('');
    setSuccess('');
    setBusySection('download');
    try {
      const response = await fetch('/api/lesson-plans/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(content),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Құжатты жасау мүмкін болмады.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ҚМЖ-${content.grade}-${content.date.replaceAll('.', '-')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('ҚМЖ құжаты жүктелді және «Құжаттар» орталығында сақталды.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Құжатты жасау мүмкін болмады.');
    } finally {
      setBusySection(null);
    }
  }

  const isBusy = busySection !== null;

  return (
    <div className="builder">
      <div className="builder-intro">
        <FileText size={21} />
        <div>
          <strong>№130 бұйрыққа сай ресми Word үлгісі</strong>
          <p>
            Бұл форма мемлекеттік үлгідегі ҚМЖ кесте ұяшықтарын толтырады. AI нәтижесін Word жасамас бұрын толық
            өңдей аласыз немесе жеке кезеңдерін қайта генерациялай аласыз.
          </p>
        </div>
      </div>

      <div className="builder-grid">
        <label>
          Педагог
          <input
            value={content.teacher}
            onChange={e => field('teacher', e.target.value)}
            placeholder="Мысалы: Ажаров Талғат"
          />
        </label>
        <label>
          Пән
          <input
            value={content.subject}
            onChange={e => field('subject', e.target.value)}
            placeholder="Информатика"
          />
        </label>
        <label>
          Сынып
          <input
            value={content.grade}
            onChange={e => field('grade', e.target.value)}
            placeholder="7А"
          />
        </label>
        <label>
          Күні
          <input
            value={content.date}
            onChange={e => field('date', e.target.value)}
          />
        </label>
        <label>
          Сабақ түрі
          <input
            value={content.lessonType}
            onChange={e => field('lessonType', e.target.value)}
            placeholder="Аралас сабақ"
          />
        </label>
        <label>
          Бөлім
          <input
            value={content.unit}
            onChange={e => field('unit', e.target.value)}
            placeholder="Мысалы: Бағдарламалау (Python)"
          />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Сабақтың тақырыбы
          <input
            value={content.topic}
            onChange={e => field('topic', e.target.value)}
            placeholder="Мысалы: Python-дағы шартты операторлар (if, elif, else)"
          />
        </label>
        <label style={{ gridColumn: '1 / -1' }}>
          Оқу мақсаттары
          <textarea
            rows={2}
            value={content.learningObjectives}
            onChange={e => field('learningObjectives', e.target.value)}
            placeholder="Мысалы: 7.3.2.1 программада тармақталу командаларын қолдану (if, elif, else)"
          />
        </label>

        {/* Lesson Objectives with Toggle */}
        <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#5d697d' }}>Сабақ мақсаты</span>
            <div style={{ display: 'flex', gap: '4px', background: '#eef1f6', padding: '2px', borderRadius: '6px' }}>
              <button
                type="button"
                onClick={() => setObjectivesMode('ai')}
                style={{
                  border: 'none',
                  background: objectivesMode === 'ai' ? '#4f46e5' : 'transparent',
                  color: objectivesMode === 'ai' ? '#fff' : '#5d697d',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                AI жасасын
              </button>
              <button
                type="button"
                onClick={() => setObjectivesMode('manual')}
                style={{
                  border: 'none',
                  background: objectivesMode === 'manual' ? '#4f46e5' : 'transparent',
                  color: objectivesMode === 'manual' ? '#fff' : '#5d697d',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Өзім енгіземін
              </button>
            </div>
          </div>
          <textarea
            rows={3}
            value={content.lessonObjectives}
            onChange={e => field('lessonObjectives', e.target.value)}
            placeholder={
              objectivesMode === 'ai'
                ? '«AI арқылы ҚМЖ жасау» батырмасын басқанда сабақ мақсаты оқу мақсатына сай 3 деңгейлі болып автоматты құрастырылады...'
                : 'Сабақ мақсатын қолмен енгізіңіз...'
            }
          />
        </div>

        {/* Custom Teacher Instruction */}
        <label style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
          Мұғалімнің AI-ға арнайы нұсқауы (қосымша)
          <input
            value={customInstruction}
            onChange={e => setCustomInstruction(e.target.value)}
            placeholder="Мысалы: «Практикалық тапсырманы көбейт», «Қатені табу жаттығуын қос», «Формативті бағалауға кері байланыс қос»"
          />
        </label>

        <label>
          Сабақ ұзақтығы, минут
          <input
            type="number"
            min={1}
            max={180}
            value={content.duration}
            onChange={e => field('duration', Number(e.target.value))}
          />
        </label>
        <label>
          Қатысу туралы мәлімет
          <input
            value={content.attendance}
            onChange={e => field('attendance', e.target.value)}
            placeholder="Қатысқандар:      Қатыспағандар:    "
          />
        </label>
      </div>

      <div className="modal-actions" style={{ justifyContent: 'flex-start', marginTop: '16px' }}>
        <button
          className="secondary"
          disabled={isBusy || !content.topic.trim() || !content.learningObjectives.trim()}
          onClick={() => void generate('all')}
        >
          <Sparkles size={17} />
          {busySection === 'all' ? 'ҚМЖ жасалуда…' : 'AI арқылы ҚМЖ жасау'}
        </button>
      </div>

      {/* Duration validation bar */}
      <div
        className={`duration-check ${total === content.duration ? 'valid' : 'invalid'}`}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}
      >
        <div>
          Кезеңдер: {total} минут / сабақ: {content.duration} минут{' '}
          {total === content.duration ? '✓' : '— уақыт сәйкес келмейді'}
        </div>
        {total !== content.duration && (
          <button
            type="button"
            onClick={balanceDuration}
            style={{
              border: '1px solid #e2a085',
              background: '#fff',
              color: '#b97a5c',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Уақытты автоматты теңестіру
          </button>
        )}
      </div>

      {/* Stage Editors */}
      {(['start', 'middle', 'end'] as const).map((key, i) => {
        const stageName = ['Сабақтың басы', 'Сабақтың ортасы', 'Сабақтың соңы'][i];
        const regenLabel = ['Басын қайта жасау', 'Ортасын қайта жасау', 'Соңын қайта жасау'][i];
        const isThisBusy = busySection === key;

        return (
          <section className="stage-editor" key={key}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <h3 style={{ margin: 0 }}>{stageName}</h3>
              <button
                type="button"
                className="secondary"
                disabled={isBusy || !content.topic.trim() || !content.learningObjectives.trim()}
                onClick={() => void generate(key)}
                style={{ fontSize: '11px', padding: '6px 12px' }}
              >
                <RefreshCw size={13} className={isThisBusy ? 'spin' : ''} />
                {isThisBusy ? 'Жасалуда…' : regenLabel}
              </button>
            </div>

            <label>
              Ұзақтығы, минут
              <input
                type="number"
                min={0}
                value={content[key].minutes}
                onChange={e => stage(key, 'minutes', Number(e.target.value))}
              />
            </label>

            <div className="stage-grid">
              {(
                [
                  ['teacher', 'Педагогтің әрекеті'],
                  ['student', 'Оқушының әрекеті'],
                  ['assessment', 'Бағалау (дескрипторлар)'],
                  ['resources', 'Ресурстар'],
                ] as const
              ).map(([fieldName, label]) => (
                <label key={fieldName}>
                  {label}
                  <textarea
                    rows={4}
                    value={content[key][fieldName]}
                    onChange={e => stage(key, fieldName, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>
        );
      })}

      {error && (
        <div className="form-error" role="alert" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: '#eaf8f0',
            color: '#28845e',
            border: '1px solid #cce8d9',
            padding: '12px 15px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          role="status"
        >
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      <button
        className="primary"
        disabled={isBusy || total !== content.duration}
        onClick={download}
        style={{ marginTop: '8px' }}
      >
        <Download size={17} />
        {busySection === 'download' ? 'Құжат дайындалуда...' : 'Word құжатын жасау (№130 бұйрық үлгісі)'}
      </button>
    </div>
  );
}
