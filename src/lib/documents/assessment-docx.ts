import 'server-only';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { Assessment } from '@/features/workspace/data';
export async function renderAssessmentDocx(assessment:Assessment,variant:'student'|'teacher'){
  const content=[new Paragraph({text:assessment.title,heading:HeadingLevel.TITLE}),new Paragraph({children:[new TextRun({text:`${assessment.kind} · ${variant==='teacher'?'Мұғалім нұсқасы':'Оқушы нұсқасы'}`,bold:true})]}),new Paragraph({text:`Бөлім: ${assessment.unit||'—'}`}),new Paragraph({text:`Тақырып: ${assessment.topic||'—'}`}),new Paragraph({text:`Оқу мақсаттары: ${(assessment.objectives||[]).join('; ')}`}),new Paragraph({text:`Жалпы балл: ${assessment.totalPoints||0} · Уақыт: ${assessment.durationMinutes||0} минут`}),new Paragraph({text:'Оқушы: ____________________________    Күні: ____________'}),new Paragraph({text:''})];
  for(const [index,q] of (assessment.questions||[]).entries()){
    content.push(new Paragraph({text:`${index+1}-тапсырма (${q.points} балл)`,heading:HeadingLevel.HEADING_2}));
    content.push(new Paragraph({text:q.question}));
    content.push(new Paragraph({text:'Жауап: __________________________________________________________'}));
    if(variant==='teacher'){content.push(new Paragraph({children:[new TextRun({text:'Дұрыс жауап: ',bold:true}),new TextRun(q.answer)]}));content.push(new Paragraph({text:`Критерий: ${q.criterion}`}));for(const d of q.descriptors)content.push(new Paragraph({text:`• ${d.text} — ${d.points} балл`}));}
    content.push(new Paragraph({text:''}));
  }
  const doc=new Document({sections:[{properties:{page:{margin:{top:900,right:900,bottom:900,left:900}}},children:content}]});return Packer.toBuffer(doc);
}
