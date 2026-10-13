import { describe, expect, it } from 'vitest';
import { calculateAnalytics } from './calculate';
import type { GradingRecord } from '@/features/grading/types';
import type { WorkspaceData } from '@/features/workspace/data';

const workspace: WorkspaceData = {
  classes: [{ id: 'c', name: '7А', subject: 'Информатика', room: '1' }],
  students: [{ id: 's', name: 'Аружан', classId: 'c', average: 0, trend: 0 }],
  assessments: [{ id: 'a', classId: 'c', title: 'Алгоритмдер', kind: 'БЖБ', date: '', average: 0, topic: 'Алгоритмдер' }],
  documents: [],
};

function record(id: string, status: GradingRecord['status'], score: number): GradingRecord {
  return {
    id,
    teacherId: 't',
    classId: 'c',
    assessmentId: 'a',
    studentId: 's',
    status,
    originalName: 'test.docx',
    storageKey: 'key',
    mimeType: '',
    size: 0,
    ocrText: '',
    ocrConfidence: 90,
    ocrWarnings: [],
    items: [],
    aiScore: score,
    maxScore: 20,
    teacherScore: score,
    audit: [],
    createdAt: '2026-10-13T00:00:00Z',
  };
}

describe('approved analytics', () => {
  it('excludes unapproved work and computes average, averageScore, median, success', () => {
    const result = calculateAnalytics(workspace, [
      record('1', 'APPROVED', 16),
      record('2', 'APPROVED', 10),
      record('3', 'TEACHER_REVIEW', 20),
    ]);
    expect(result.count).toBe(2);
    expect(result.average).toBe(65);
    expect(result.averageScore).toBe(13);
    expect(result.highest).toBe(80);
    expect(result.lowest).toBe(50);
    expect(result.median).toBe(65);
    expect(result.successRate).toBe(50);
    expect(result.topicMastery[0].percentage).toBe(65);
  });

  it('returns empty metrics before approval', () => {
    const result = calculateAnalytics(workspace, [record('1', 'TEACHER_REVIEW', 18)]);
    expect(result.count).toBe(0);
    expect(result.average).toBe(0);
    expect(result.averageScore).toBe(0);
    expect(result.studentProgress).toHaveLength(0);
  });
});
