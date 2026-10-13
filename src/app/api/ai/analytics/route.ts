import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { getWorkspace } from '@/lib/workspace/repository';
import { listGrading } from '@/lib/grading/repository';
import { calculateAnalytics } from '@/features/analytics/calculate';
import { getAIProvider, getAIRequestConfig, recordAIRequest } from '@/lib/ai/provider';

const requestSchema = z.object({
  classId: z.string().optional(),
});

const aiAnalyticsSchema = z.object({
  insights: z.array(z.object({
    fact: z.string(),
    recommendation: z.string(),
  })),
  summary: z.string(),
});

export async function POST(request: Request) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Кіру қажет.' }, { status: 401 });

  const started = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const { classId } = requestSchema.parse(body);

    const [workspace, records] = await Promise.all([
      getWorkspace(user.id),
      listGrading(user.id),
    ]);

    const analytics = calculateAnalytics(workspace, records, classId);
    const className = classId ? (workspace.classes.find(c => c.id === classId)?.name ?? classId) : 'Барлық сыныптар';

    if (analytics.count === 0) {
      return NextResponse.json({
        data: {
          insights: [],
          summary: 'Талдау жасау үшін алдымен оқушы жұмыстарын тексеріп, бағаларды бекітіңіз.',
        },
        mode: 'demo',
      });
    }

    const factsData = {
      className,
      approvedCount: analytics.count,
      averagePercent: analytics.average,
      averageScore: analytics.averageScore,
      highest: analytics.highest,
      lowest: analytics.lowest,
      topicMastery: analytics.topicMastery,
      criterionMastery: analytics.criterionMastery,
      weakStudents: analytics.studentProgress.filter(s => s.average < 60),
    };

    const provider = getAIProvider(getAIRequestConfig(request));

    const mockInsights = analytics.topicMastery.map(t => {
      let rec = 'Жалпы нәтиже жақсы деңгейде.';
      if (t.percentage < 60) {
        rec = 'Сыныптың осы тақырып бойынша нәтижесі төмен. Қайталау тапсырмасын қолдану және жеке жұмыс ұсынылады.';
      } else if (t.percentage < 80) {
        rec = 'Тақырып бойынша қосымша бекіту жаттығуларын орындау пайдалы.';
      } else {
        rec = 'Тақырып терең меңгерілген, күрделі деңгейдегі практикалық тапсырмаларға көшуге болады.';
      }
      return {
        fact: `${t.topic} — ${t.percentage}%`,
        recommendation: rec,
      };
    });

    const mockSummary = `${className} бойынша барлығы ${analytics.count} бекітілген жұмыс талданды. Орташа нәтиже — ${analytics.average}%. Ең жоғары — ${analytics.highest}%, ең төмен — ${analytics.lowest}%.`;

    const mockValue = {
      insights: mockInsights,
      summary: mockSummary,
    };

    const prompt = `Сен — Қазақстанның жаңартылған білім беру мазмұны бойынша сарапшысың.
Төменде берілген нақты деректер мен статистика негізінде мұғалімге педагогикалық аналитика жаса.
МАҢЫЗДЫ ТАЛАП:
Факт пен AI ұсынысын қатаң түрде бөл!
"fact" өрісіне тек нақты сандық фактіні жаз (мысалы: "Алгоритм ұғымы — 72%").
"recommendation" өрісіне сол фактіге сай мұғалімге әдістемелік ұсынысты жаз (мысалы: "Қайталау тапсырмасын қолдану ұсынылады.").
Сандарды өзгертпе немесе ойдан шығарма.

Деректер:
${JSON.stringify(factsData)}`;

    const data = await provider.generateStructured(
      aiAnalyticsSchema,
      'ai_analytics_insight',
      prompt,
      mockValue
    );

    await recordAIRequest(user.id, 'aiAnalytics', provider.name, 'succeeded', Date.now() - started);

    return NextResponse.json({
      data,
      mode: provider.mode,
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Аналитикалық қорытынды жасалмады.',
    }, { status: 400 });
  }
}
