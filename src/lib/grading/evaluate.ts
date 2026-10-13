import 'server-only';
import { z } from 'zod';
import type { AssessmentQuestion } from '@/features/workspace/data';
import type { GradeItem } from '@/features/grading/types';
import type { AIProvider } from '@/lib/ai/provider';

function normalize(text: string) { return text.toLocaleLowerCase('kk').replace(/\s+/g, ' ').replace(/[.,!?;:]/g, '').trim(); }

export function evaluateText(questions: AssessmentQuestion[], recognizedText: string, ocrConfidence: number): GradeItem[] {
  const answer = normalize(recognizedText);
  return questions.map(question => {
    const exact = !!answer && !!question.answer && answer.includes(normalize(question.answer));
    const objective = ['single', 'multiple', 'true_false', 'short'].includes(question.type);
    const score = exact && objective ? question.points : 0;
    const confidence = exact && objective ? Math.min(100, Math.round(ocrConfidence)) : 0;
    return { questionId: question.id, question: question.question, recognizedAnswer: recognizedText, criterion: question.criterion,
      descriptorResults: question.descriptors.map(descriptor => ({ text: descriptor.text, met: exact && objective, points: descriptor.points })),
      aiScore: score, maxScore: question.points, confidence,
      reason: !answer ? 'Мәтін танылмады. Мұғалім жауабын тексеруі керек.' : !objective ? 'Ашық тапсырма мұғалімнің тексеруін қажет етеді.' : exact ? 'Жауап кілтпен дәл сәйкес келді.' : 'Жауап кілтпен дәл сәйкес келмеді; мұғалім тексеруі керек.',
      needsReview: !exact || !objective || confidence < 70 };
  });
}

const aiEvaluationSchema = z.object({ answers: z.array(z.object({
  questionNumber: z.number().int().min(1), recognizedAnswer: z.string(),
  descriptorResults: z.array(z.object({ descriptor: z.string(), achieved: z.boolean(), reason: z.string() })),
  confidence: z.number().min(0).max(100), feedback: z.string(),
})) });

export async function evaluateWithAI(provider: AIProvider, questions: AssessmentQuestion[], recognizedText: string, ocrConfidence: number): Promise<GradeItem[]> {
  if (provider.mode === 'demo') return evaluateText(questions, recognizedText, ocrConfidence);
  const prompt = `Оқушы жұмысын тек берілген дескрипторлар бойынша бағала. Балл ойлап қоспа. answers массивінде әр сұрақ үшін бір объект бер. descriptorResults ішінде әр дескрипторды дәл сол мәтінмен қайтала және achieved мәнін анықта. Оқушы мәтіні:\n${recognizedText}\n\nТапсырмалар JSON:\n${JSON.stringify(questions.map((question, index) => ({ questionNumber: index + 1, question: question.question, correctAnswer: question.answer, criterion: question.criterion, descriptors: question.descriptors })))}`;
  const example = { answers: questions.map((question, index) => ({ questionNumber: index + 1, recognizedAnswer: '', descriptorResults: question.descriptors.map(descriptor => ({ descriptor: descriptor.text, achieved: false, reason: '' })), confidence: 0, feedback: '' })) };
  const result = await provider.generateStructured(aiEvaluationSchema, 'descriptor_evaluation', prompt, example);
  return questions.map((question, index) => {
    const answer = result.answers.find(item => item.questionNumber === index + 1);
    const descriptorResults = question.descriptors.map(descriptor => {
      const item = answer?.descriptorResults.find(candidate => normalize(candidate.descriptor) === normalize(descriptor.text));
      return { text: descriptor.text, met: item?.achieved === true, points: descriptor.points };
    });
    const aiScore = Math.min(question.points, descriptorResults.reduce((sum, item) => sum + (item.met ? item.points : 0), 0));
    const confidence = Math.min(Math.round(ocrConfidence), Math.round(answer?.confidence ?? 0));
    return { questionId: question.id, question: question.question, recognizedAnswer: answer?.recognizedAnswer ?? '', criterion: question.criterion,
      descriptorResults, aiScore, maxScore: question.points, confidence, reason: answer?.feedback || 'AI жауабын сенімді бағалай алмады.', needsReview: confidence < 70 || !answer };
  });
}
