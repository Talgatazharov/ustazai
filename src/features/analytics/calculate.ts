import type { GradingRecord } from '@/features/grading/types';
import type { WorkspaceData } from '@/features/workspace/data';

export type Analytics = {
  count: number;
  average: number;
  averageScore: number;
  median: number;
  highest: number;
  lowest: number;
  successRate: number;
  distribution: { label: string; count: number }[];
  studentProgress: { studentId: string; name: string; average: number; count: number }[];
  assessmentComparison: { assessmentId: string; title: string; average: number; count: number }[];
  topicMastery: { topic: string; percentage: number; count: number }[];
  criterionMastery: { criterion: string; percentage: number; count: number }[];
  descriptorMastery: { descriptor: string; percentage: number; count: number }[];
  dynamics: { label: string; percentage: number }[];
  alerts: { type: 'LOW_SCORE' | 'FAILED' | 'DECLINE'; text: string }[];
};

export function calculateAnalytics(workspace: WorkspaceData, records: GradingRecord[], classId?: string): Analytics {
  const approved = records.filter(r => r.status === 'APPROVED' && r.maxScore > 0 && (!classId || r.classId === classId));
  const percentages = approved.map(r => Math.round(100 * (r.teacherScore ?? r.aiScore) / r.maxScore));
  const scores = approved.map(r => r.teacherScore ?? r.aiScore);
  const sorted = [...percentages].sort((a, b) => a - b);

  const average = percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0;
  const averageScore = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : 0;
  const median = sorted.length ? (sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)) : 0;
  const successRate = percentages.length ? Math.round(100 * percentages.filter(v => v >= 60).length / percentages.length) : 0;
  const highest = percentages.length ? Math.max(...percentages) : 0;
  const lowest = percentages.length ? Math.min(...percentages) : 0;

  const distribution = [
    { label: '0–39%', count: percentages.filter(v => v < 40).length },
    { label: '40–59%', count: percentages.filter(v => v >= 40 && v < 60).length },
    { label: '60–79%', count: percentages.filter(v => v >= 60 && v < 80).length },
    { label: '80–100%', count: percentages.filter(v => v >= 80).length },
  ];

  const studentProgress = workspace.students
    .filter(s => !classId || s.classId === classId)
    .map(student => {
      const own = approved.filter(r => r.studentId === student.id);
      return {
        studentId: student.id,
        name: student.name,
        average: own.length ? Math.round(own.reduce((sum, r) => sum + 100 * (r.teacherScore ?? r.aiScore) / r.maxScore, 0) / own.length) : 0,
        count: own.length,
      };
    })
    .filter(s => s.count > 0)
    .sort((a, b) => b.average - a.average);

  const assessmentComparison = workspace.assessments
    .filter(a => !classId || a.classId === classId)
    .map(a => {
      const own = approved.filter(r => r.assessmentId === a.id);
      return {
        assessmentId: a.id,
        title: a.title,
        average: own.length ? Math.round(own.reduce((sum, r) => sum + 100 * (r.teacherScore ?? r.aiScore) / r.maxScore, 0) / own.length) : 0,
        count: own.length,
      };
    })
    .filter(a => a.count > 0);

  const topicMap = new Map<string, { sum: number; count: number }>();
  for (const r of approved) {
    const assessment = workspace.assessments.find(a => a.id === r.assessmentId);
    const topic = assessment?.topic || assessment?.title || 'Басқа';
    const current = topicMap.get(topic) || { sum: 0, count: 0 };
    current.sum += 100 * (r.teacherScore ?? r.aiScore) / r.maxScore;
    current.count++;
    topicMap.set(topic, current);
  }
  const topicMastery = [...topicMap]
    .map(([topic, v]) => ({ topic, percentage: Math.round(v.sum / v.count), count: v.count }))
    .sort((a, b) => a.percentage - b.percentage);

  const criterionMap = new Map<string, { earned: number; max: number; count: number }>();
  const descriptorMap = new Map<string, { earned: number; max: number; count: number }>();

  for (const record of approved) {
    for (const item of record.items) {
      const criterion = item.criterion || item.question;
      const c = criterionMap.get(criterion) || { earned: 0, max: 0, count: 0 };
      c.earned += item.teacherScore ?? item.aiScore;
      c.max += item.maxScore;
      c.count++;
      criterionMap.set(criterion, c);

      for (const descriptor of item.descriptorResults) {
        const d = descriptorMap.get(descriptor.text) || { earned: 0, max: 0, count: 0 };
        d.earned += descriptor.met ? descriptor.points : 0;
        d.max += descriptor.points;
        d.count++;
        descriptorMap.set(descriptor.text, d);
      }
    }
  }

  const criterionMastery = [...criterionMap]
    .map(([criterion, v]) => ({ criterion, percentage: v.max ? Math.round(100 * v.earned / v.max) : 0, count: v.count }))
    .sort((a, b) => a.percentage - b.percentage);

  const descriptorMastery = [...descriptorMap]
    .map(([descriptor, v]) => ({ descriptor, percentage: v.max ? Math.round(100 * v.earned / v.max) : 0, count: v.count }))
    .sort((a, b) => a.percentage - b.percentage);

  const dynamics = [...approved]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((record, index) => ({
      label: `${index + 1}-жұмыс`,
      percentage: Math.round(100 * (record.teacherScore ?? record.aiScore) / record.maxScore),
    }));

  const alerts: Analytics['alerts'] = [];
  for (const student of studentProgress.filter(s => s.average < 60)) {
    alerts.push({ type: 'LOW_SCORE', text: `${student.name}: бекітілген жұмыстардың орташа нәтижесі ${student.average}%.` });
  }
  for (const r of records.filter(r => r.status === 'FAILED' && (!classId || r.classId === classId))) {
    alerts.push({ type: 'FAILED', text: `${r.originalName}: өңдеу кезінде қате болды.` });
  }

  return {
    count: approved.length,
    average,
    averageScore,
    median,
    highest,
    lowest,
    successRate,
    distribution,
    studentProgress,
    assessmentComparison,
    topicMastery,
    criterionMastery,
    descriptorMastery,
    dynamics,
    alerts,
  };
}
