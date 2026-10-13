import { describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
vi.mock('server-only',()=>({}));
import { analyzeTemplate, generateLessonDocx, lessonDuration } from './lesson-template';
const templateExists=existsSync(path.join(process.cwd(),'templates/private/canonical-kmz.docx'));
describe.skipIf(!templateExists)('canonical ҚМЖ template',()=>{
  const stage={minutes:5,teacher:'Педагог әрекеті',student:'Оқушы әрекеті',assessment:'Бағалау',resources:'Кітап'};
  const input={teacher:'Тест мұғалім',subject:'Математика',grade:'5А',date:'13.10.2026',lessonType:'Аралас сабақ',unit:'Бөлшектер',topic:'Жаңа тақырып',learningObjectives:'Мақсат 1',lessonObjectives:'Мақсат 2',duration:45,attendance:'Қатысқандар: 20',start:stage,middle:{...stage,minutes:35},end:stage};
  it('checks stage duration',()=>{expect(lessonDuration(input)).toBe(45);expect(lessonDuration({...input,end:{...stage,minutes:8}})).toBe(48);});
  it('preserves table shape and removes every old lesson body row',async()=>{const before=await analyzeTemplate();const generated=await generateLessonDocx(input);expect(generated.validation.sameStructure).toBe(true);const zip=await JSZip.loadAsync(generated.buffer);const xml=await zip.file('word/document.xml')!.async('string');expect(xml).toContain('Жаңа тақырып');expect(xml).not.toContain('Жай бөлшектің негізгі қасиеті');expect((xml.match(/<w:tbl[ >]/g)||[]).length).toBe(before.tableCount);
    const doc=new DOMParser().parseFromString(xml,'application/xml');const rows=Array.from(doc.getElementsByTagName('w:tbl')[0].getElementsByTagName('w:tr'));
    for(const rowIndex of [10,12,13,14,15,16]){const cells=Array.from(rows[rowIndex].childNodes).filter(node=>node.nodeName==='w:tc');for(const cell of cells)expect((cell.textContent??'').trim(),`old content in row ${rowIndex}`).toBe('');}
  });
});
