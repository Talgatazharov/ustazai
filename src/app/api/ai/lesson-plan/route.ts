import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { lessonSchema, lessonDuration, type LessonContent } from '@/lib/documents/lesson-template';
import { getAIProvider, getAIRequestConfig } from '@/lib/ai/provider';
import { formatZodError } from '@/features/assessments/schema';

const stageSchema = z.object({
  minutes: z.coerce.number().int().min(0).default(0),
  teacher: z.string().default(''),
  student: z.string().default(''),
  assessment: z.string().default(''),
  resources: z.string().default(''),
});

const lessonRequestSchema = z.object({
  teacher: z.string().trim().min(2, 'Педагогтің аты-жөнін енгізіңіз (кемінде 2 таңба)'),
  subject: z.string().trim().min(2, 'Пәнді енгізіңіз'),
  grade: z.string().trim().min(1, 'Сыныпты енгізіңіз'),
  date: z.string().trim().min(1, 'Күнді енгізіңіз'),
  lessonType: z.string().default('Аралас сабақ'),
  unit: z.string().trim().min(2, 'Бөлімді енгізіңіз (кемінде 2 таңба)'),
  topic: z.string().trim().min(2, 'Сабақтың тақырыбын енгізіңіз (кемінде 2 таңба)'),
  learningObjectives: z.string().trim().min(2, 'Оқу мақсатын енгізіңіз (кемінде 2 таңба)'),
  lessonObjectives: z.string().default(''),
  aiGenerateObjectives: z.boolean().optional().default(false),
  duration: z.coerce.number().int().min(1).max(180).default(45),
  attendance: z.string().default(''),
  customInstruction: z.string().optional().default(''),
  regenerateSection: z.enum(['all', 'start', 'middle', 'end']).optional().default('all'),
  start: stageSchema.optional(),
  middle: stageSchema.optional(),
  end: stageSchema.optional(),
});

export async function POST(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: 'Кіру қажет.' }, { status: 401 });
  try {
    const rawBody = await request.json();
    const input = lessonRequestSchema.parse(rawBody);
    const provider = getAIProvider(getAIRequestConfig(request));

    // Calculate stage minutes respecting section regeneration
    let startMinutes: number;
    let middleMinutes: number;
    let endMinutes: number;

    if (input.regenerateSection === 'start') {
      const curMiddle = input.middle?.minutes || Math.max(1, input.duration - 10);
      const curEnd = input.end?.minutes || 5;
      middleMinutes = curMiddle;
      endMinutes = curEnd;
      startMinutes = Math.max(1, input.duration - middleMinutes - endMinutes);
    } else if (input.regenerateSection === 'middle') {
      const curStart = input.start?.minutes || 5;
      const curEnd = input.end?.minutes || 5;
      startMinutes = curStart;
      endMinutes = curEnd;
      middleMinutes = Math.max(1, input.duration - startMinutes - endMinutes);
    } else if (input.regenerateSection === 'end') {
      const curStart = input.start?.minutes || 5;
      const curMiddle = input.middle?.minutes || Math.max(1, input.duration - 10);
      startMinutes = curStart;
      middleMinutes = curMiddle;
      endMinutes = Math.max(1, input.duration - startMinutes - middleMinutes);
    } else {
      startMinutes = Math.max(1, Math.round(input.duration * 0.12));
      endMinutes = Math.max(1, Math.round(input.duration * 0.12));
      middleMinutes = input.duration - startMinutes - endMinutes;
    }

    const python = /python|шартты оператор|тармақталу|if\b/i.test(input.topic);
    const example = python ? 'if x > 0: print("оң") / elif x == 0: print("нөл") / else: print("теріс")' : input.topic;
    const customNote = input.customInstruction?.trim() ? ` (Мұғалім нұсқауы ескерілді: «${input.customInstruction.trim()}»)` : '';

    const shouldGenerateObjectives = input.aiGenerateObjectives || !input.lessonObjectives.trim();
    const defaultObjectives = python
      ? 'Барлық оқушылар: Python-дағы шартты операторлардың (if, elif, else) жазылу синтаксисін біледі.\nКөпшілігі: берілген шартқа байланысты код тармақталуын дұрыс анықтайды және тармақталған қарапайым программа жазады.\nКейбірі: шегініс қателерін түзетеді және берілген есепке өз бетінше оңтайлы программа құрады.'
      : `Барлық оқушылар: ${input.topic} бойынша негізгі ұғымдар мен ережелерді біледі.\nКөпшілігі: тақырыпқа сай практикалық есептер мен тапсырмаларды орындайды.\nКейбірі: алған білімін жаңа жағдайда қолданып, өзіндік қорытынды жасайды.`;
    const resolvedLessonObjectives = shouldGenerateObjectives ? defaultObjectives : input.lessonObjectives.trim();

    const mockStart = {
      minutes: startMinutes,
      teacher: `${input.topic} тақырыбына кіріспе: «${example}» мысалы бойынша болжам сұрақтар қояды және қызығушылықты оятады.${customNote}`,
      student: `Мысалдың нәтижесін болжайды, топта талқылайды және сабақ мақсатымен танысады.`,
      assessment: 'Болжам мен белсенділікті ауызша кері байланыспен және смайликтер арқылы бағалайды.',
      resources: 'Интербелсенді тақта, слайд, код карточкалары',
    };

    const mockMiddle = {
      minutes: middleMinutes,
      teacher: python
        ? `if/elif/else тармақтарының орындалу ретін кодпен көрсетеді. 1) «Кодты талдау»: дайын код үзіндісінің нәтижесін болжау; 2) «Қатені тап»: шегініс (indentation) және қоснүкте қателерін табу және түзету; 3) «Программа құру»: пайдаланушы енгізген санның таңбасын анықтайтын программа жазу.${customNote}`
        : `${input.topic} бойынша үш деңгейлі нақты тапсырма береді: 1) негізгі ұғымдарды анықтау және сәйкестендіру; 2) тақырыпқа сай практикалық есептер шығару; 3) қатені тауып, жеке шешімін дәлелдеу.${customNote}`,
      student: python
        ? 'Код нәтижесін жазады, шегініс қатесін түзетеді, if/elif/else қолданып сан таңбасын анықтайтын программа жазады және оны әртүрлі мәндермен сынайды.'
        : `${input.topic} бойынша мысалды талдайды, практикалық тапсырманы орындайды, шешімін дәлелдейді.`,
      assessment: python
        ? 'Дескрипторлар: 1) if, elif шарттарын дұрыс жазады (1 балл); 2) шегініс ережесін сақтайды (1 балл); 3) бағдарламаны 3 түрлі мәнмен (оң, теріс, нөл) тексеріп нәтижесін алады (2 балл).'
        : 'Дескрипторлар: 1) негізгі ережені анықтайды (1 балл); 2) тапсырманы қатесіз орындайды (2 балл); 3) нәтижесін дәлелдейді (1 балл).',
      resources: python
        ? 'Python IDLE ортасы, код карточкалары, бағалау парағы'
        : 'Оқулық, үлестірме материалдар, тапсырма парағы',
    };

    const mockEnd = {
      minutes: endMinutes,
      teacher: `${input.topic} бойынша қорытынды сұрақ қойып, сабақ мақсатына жетуді тексереді және үй тапсырмасын түсіндіреді.${customNote}`,
      student: '«Шығу билеті» бойынша негізгі үйренгенін жазады және кері байланыс береді.',
      assessment: 'Шығу билеті: тақырыпқа қатысты бір шағын есепті дұрыс шешу. Өзін-өзі бағалау.',
      resources: 'Рефлексия парағы, стикерлер',
    };

    const mock: LessonContent = {
      teacher: input.teacher,
      subject: input.subject,
      grade: input.grade,
      date: input.date,
      lessonType: input.lessonType,
      unit: input.unit,
      topic: input.topic,
      learningObjectives: input.learningObjectives,
      lessonObjectives: resolvedLessonObjectives,
      duration: input.duration,
      attendance: input.attendance,
      start: input.regenerateSection === 'middle' && input.start ? { ...input.start, minutes: startMinutes } : (input.regenerateSection === 'end' && input.start ? { ...input.start, minutes: startMinutes } : mockStart),
      middle: input.regenerateSection === 'start' && input.middle ? { ...input.middle, minutes: middleMinutes } : (input.regenerateSection === 'end' && input.middle ? { ...input.middle, minutes: middleMinutes } : mockMiddle),
      end: input.regenerateSection === 'start' && input.end ? { ...input.end, minutes: endMinutes } : (input.regenerateSection === 'middle' && input.end ? { ...input.end, minutes: endMinutes } : mockEnd),
    };

    const sectionInstruction = input.regenerateSection === 'all'
      ? 'Барлық кезеңдерді (басы, ортасы, соңы) сапалы түрде жаса.'
      : input.regenerateSection === 'start'
      ? 'Тек «Сабақтың басы» (start) кезеңін жаңарт, оқушылардың қызығушылығын оятатын мысал қос.'
      : input.regenerateSection === 'middle'
      ? 'Тек «Сабақтың ортасы» (middle) кезеңін жаңарт, 1), 2), 3) нақты тапсырмалар мен дескрипторлар қос.'
      : 'Тек «Сабақтың соңы» (end) кезеңін жаңарт, рефлексия мен шығу билетін қос.';

    const customPromptInstruction = input.customInstruction?.trim()
      ? `Мұғалімнің арнайы қосымша нұсқауы: «${input.customInstruction.trim()}». Осы талапты сабақтың тиісті кезеңінде міндетті түрде ескер.\n`
      : '';

    const prompt = `Қазақ тілінде №130 бұйрық нысанындағы ҚМЖ мазмұнын жаса.
Берілген пән: ${input.subject}, сынып: ${input.grade}, бөлім: ${input.unit}, тақырып: ${input.topic}, оқу мақсаты: ${input.learningObjectives}.
${shouldGenerateObjectives ? 'Сабақ мақсатын (lessonObjectives) оқу мақсатына сай 3 деңгейлі немесе нақты өлшенетін етіп жаз.' : `Сабақ мақсаты: ${input.lessonObjectives}`}
Сабақ кезеңдерінің минуттары ${startMinutes}+${middleMinutes}+${endMinutes}=${input.duration} болсын.
${sectionInstruction}
${customPromptInstruction}
Әр кезеңдегі teacher, student, assessment, resources өрістерін осы сабаққа арнайы жаз.
middle.teacher ішінде нөмірленген 1), 2), 3) үш нақты тапсырма және кемінде бір код үзіндісі болсын.
middle.student ішінде әр тапсырма бойынша күтілетін нақты әрекетті жаз.
middle.assessment ішінде сол үш тапсырмаға сәйкес бақыланатын дескрипторлар болсын.
${python ? 'Python шартты операторлары үшін if, elif, else кодын, код нәтижесін болжауды, қатені табуды және шағын программа құруды тапсырмаға енгіз.' : ''}
Бастапқы үлгі: ${JSON.stringify(mock)}`;

    let generated: LessonContent = await provider.generateStructured(lessonSchema, 'lesson_plan', prompt, mock);

    if (provider.mode === 'real' && python && (!/1\)/.test(generated.middle.teacher) || !/2\)/.test(generated.middle.teacher) || !/3\)/.test(generated.middle.teacher) || !/if\b/i.test(generated.middle.teacher) || !/elif\b/i.test(generated.middle.teacher))) {
      generated = await provider.generateStructured(lessonSchema, 'lesson_plan', `${prompt}\nАлдыңғы жауап тым жалпылама болды. middle.teacher өрісін міндетті түрде 1), 2), 3) деп нөмірле; Python кодының нақты жолдарын, if және elif тармақтарын жаз. Әр тапсырмаға сәйкес дескриптор бер.`, mock);
    }

    if (provider.mode === 'real' && python && (!/1\)/.test(generated.middle.teacher) || !/2\)/.test(generated.middle.teacher) || !/3\)/.test(generated.middle.teacher) || !/if\b/i.test(generated.middle.teacher) || !/elif\b/i.test(generated.middle.teacher))) {
      throw new Error('AI нақты үш тапсырмасы бар ҚМЖ жасай алмады. Қайта көріңіз.');
    }

    // Merge generated data with input, respecting partial section regeneration
    const finalStart = input.regenerateSection === 'all' || input.regenerateSection === 'start'
      ? { ...generated.start, minutes: startMinutes }
      : (input.start ? { ...input.start, minutes: startMinutes } : mock.start);

    const finalMiddle = input.regenerateSection === 'all' || input.regenerateSection === 'middle'
      ? { ...generated.middle, minutes: middleMinutes }
      : (input.middle ? { ...input.middle, minutes: middleMinutes } : mock.middle);

    const finalEnd = input.regenerateSection === 'all' || input.regenerateSection === 'end'
      ? { ...generated.end, minutes: endMinutes }
      : (input.end ? { ...input.end, minutes: endMinutes } : mock.end);

    const finalLessonObjectives = shouldGenerateObjectives
      ? (generated.lessonObjectives?.trim() || defaultObjectives)
      : input.lessonObjectives.trim();

    const data: LessonContent = {
      teacher: input.teacher,
      subject: input.subject,
      grade: input.grade,
      date: input.date,
      lessonType: input.lessonType,
      unit: input.unit,
      topic: input.topic,
      learningObjectives: input.learningObjectives,
      lessonObjectives: finalLessonObjectives,
      duration: input.duration,
      attendance: input.attendance,
      start: finalStart,
      middle: finalMiddle,
      end: finalEnd,
    };

    // Strict duration verification and auto-normalization
    const currentTotal = lessonDuration(data);
    if (currentTotal !== input.duration) {
      data.middle.minutes = input.duration - data.start.minutes - data.end.minutes;
    }

    return NextResponse.json({ data, mode: provider.mode });
  } catch (error) {
    return NextResponse.json({ error: formatZodError(error) }, { status: 400 });
  }
}
