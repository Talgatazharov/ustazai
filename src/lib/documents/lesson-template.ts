import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer, type Document as XmlDocument, type Node as XmlNode, type Element as XmlElement } from '@xmldom/xmldom';
import { z } from 'zod';

const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const templatePath=path.join(process.cwd(),'templates','private','canonical-kmz.docx');
export const lessonSchema=z.object({
  teacher:z.string().trim().min(2), subject:z.string().trim().min(2), grade:z.string().trim().min(1), date:z.string().trim().min(1),lessonType:z.string().default('Аралас сабақ'),
  unit:z.string().trim().min(2), topic:z.string().trim().min(2), learningObjectives:z.string().trim().min(2), lessonObjectives:z.string().trim().min(2),
  duration:z.number().int().min(1).max(180), attendance:z.string().default(''),
  start:z.object({minutes:z.number().int().min(0),teacher:z.string(),student:z.string(),assessment:z.string(),resources:z.string()}),
  middle:z.object({minutes:z.number().int().min(0),teacher:z.string(),student:z.string(),assessment:z.string(),resources:z.string()}),
  end:z.object({minutes:z.number().int().min(0),teacher:z.string(),student:z.string(),assessment:z.string(),resources:z.string()})
});
export type LessonContent=z.infer<typeof lessonSchema>;
export function lessonDuration(content:LessonContent){return content.start.minutes+content.middle.minutes+content.end.minutes;}
function children(node:XmlNode|null,name:string){return node?Array.from(node.childNodes).filter(n=>n.nodeType===1&&n.localName===name&&n.namespaceURI===ns):[];}
function descendants(node:XmlNode|null,name:string):XmlElement[]{const result:XmlElement[]=[];if(!node)return result;for(const child of Array.from(node.childNodes)){if(child.nodeType!==1)continue;if(child.localName===name&&child.namespaceURI===ns)result.push(child as XmlElement);result.push(...descendants(child,name));}return result;}
function rowCell(doc:XmlDocument,row:number,col:number){const table=descendants(doc.documentElement,'tbl')[0];const r=children(table,'tr')[row];const cell=r&&children(r,'tc')[col];if(!cell)throw new Error(`Template cell ${row}:${col} not found`);return cell;}
function setCell(doc:XmlDocument,row:number,col:number,value:string){const cell=rowCell(doc,row,col);const paragraphs=children(cell,'p');if(!paragraphs.length)throw new Error(`Template paragraph ${row}:${col} missing`);const first=paragraphs[0];const textNodes=descendants(first,'t');if(!textNodes.length)throw new Error(`Template text run ${row}:${col} missing`);for(const child of Array.from(cell.childNodes)){if(child!==first&&child.localName!=='tcPr'&&child.localName!=='tbl')cell.removeChild(child);}const text=textNodes[0];const firstRun=text.parentNode;for(const child of Array.from(first.childNodes)){if(child!==firstRun&&child.localName!=='pPr')first.removeChild(child);}if(firstRun)for(const child of Array.from(firstRun.childNodes)){if(child!==text&&child.localName!=='rPr')firstRun.removeChild(child);}text.textContent=value;text.setAttribute('xml:space','preserve');}
function clearCell(doc:XmlDocument,row:number,col:number){const cell=rowCell(doc,row,col);const first=children(cell,'p')[0];if(!first)return;for(const child of Array.from(cell.childNodes)){if(child!==first&&child.localName!=='tcPr'&&child.localName!=='tbl')cell.removeChild(child);}for(const child of Array.from(first.childNodes)){if(child.localName!=='pPr')first.removeChild(child);}}
function setStage(doc:XmlDocument,row:number,name:string,minutes:number,stage:LessonContent['start']){
  setCell(doc,row,0,`${name} ${minutes} минут`);
  setCell(doc,row,1,stage.teacher);setCell(doc,row,2,stage.student);setCell(doc,row,3,stage.assessment);setCell(doc,row,4,stage.resources);
}
function readFingerprint(doc:XmlDocument){const tables=descendants(doc.documentElement,'tbl');const section=descendants(doc.documentElement,'sectPr')[0];const tableShapes=tables.map(t=>children(t,'tr').map(r=>children(r,'tc').map(c=>({gridSpan:descendants(c,'gridSpan')[0]?.getAttributeNS(ns,'val')??'1',vMerge:descendants(c,'vMerge')[0]?.getAttributeNS(ns,'val')??'',width:descendants(c,'tcW')[0]?.getAttributeNS(ns,'w')??''}))));
  const serializer=new XMLSerializer();const page=section?{size:descendants(section,'pgSz')[0]?serializer.serializeToString(descendants(section,'pgSz')[0]):'',margin:descendants(section,'pgMar')[0]?serializer.serializeToString(descendants(section,'pgMar')[0]):''}:null;
  const mapped=[[0,1],[1,1],[2,1],[3,0],[3,1],[4,1],[5,1],[6,1],...[9,11,17].flatMap(row=>[0,1,2,3,4].map(col=>[row,col]))];
  const mappedStyles=mapped.map(([row,col])=>{const cell=rowCell(doc,row,col);const first=children(cell,'p')[0];const paragraph=children(first,'pPr')[0];const run=descendants(first,'r')[0];const runStyle=run?children(run,'rPr')[0]:null;return {row,col,cell:children(cell,'tcPr')[0]?serializer.serializeToString(children(cell,'tcPr')[0]):'',paragraph:paragraph?serializer.serializeToString(paragraph):'',run:runStyle?serializer.serializeToString(runStyle):''};});
  return {tableShapes,sectionCount:descendants(doc.documentElement,'sectPr').length,page,mappedStyles};
}
async function readDocx(){const source=await fs.readFile(templatePath);const zip=await JSZip.loadAsync(source);const xml=await zip.file('word/document.xml')?.async('string');if(!xml)throw new Error('DOCX құжаты оқылмады.');const doc=new DOMParser().parseFromString(xml,'application/xml');return {zip,doc};}
export async function analyzeTemplate(){const {doc}=await readDocx();const tables=descendants(doc.documentElement,'tbl');return {fingerprint:readFingerprint(doc),tableCount:tables.length,rowCounts:tables.map(t=>children(t,'tr').length),mappings:{unit:'0:1',teacher:'1:1',date:'2:1',grade:'3:0',attendance:'3:1',topic:'4:1',learningObjectives:'5:1',lessonObjectives:'6:1',start:'9:0–4',middle:'11:0–4',end:'17:0–4'}};}
export async function generateLessonDocx(input:unknown){const content=lessonSchema.parse(input);if(lessonDuration(content)!==content.duration)throw new Error(`Сабақ кезеңдері ${lessonDuration(content)} минут, сабақ ұзақтығы ${content.duration} минут.`);const {zip,doc}=await readDocx();const before=readFingerprint(doc);
  setCell(doc,0,1,content.unit);setCell(doc,1,1,content.teacher);setCell(doc,2,1,content.date);setCell(doc,3,0,`Сынып: ${content.grade}`);setCell(doc,3,1,content.attendance||'Қатысқандар саны:     Қатыспағандар саны:');setCell(doc,4,1,content.topic);setCell(doc,5,1,content.learningObjectives);setCell(doc,6,1,content.lessonObjectives);
  setStage(doc,9,'Сабақтың басы',content.start.minutes,content.start);setStage(doc,11,'Сабақтың ортасы',content.middle.minutes,content.middle);
  // The canonical template contains a complete old lesson in its extra body rows.
  // Keep those rows and their formatting, but never carry their content into a new plan.
  for(let row=10;row<=16;row++)if(row!==11)for(let col=0;col<children(children(descendants(doc.documentElement,'tbl')[0],'tr')[row],'tc').length;col++)clearCell(doc,row,col);
  setStage(doc,17,'Сабақтың соңы',content.end.minutes,content.end);
  const after=readFingerprint(doc);if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('DOCX үлгісінің құрылымы өзгерді: '+Object.keys(before).filter(key=>JSON.stringify(before[key as keyof typeof before])!==JSON.stringify(after[key as keyof typeof after])).join(', '));
  zip.file('word/document.xml',new XMLSerializer().serializeToString(doc));
  return {buffer:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),validation:{sameStructure:true,tableCount:after.tableShapes.length,sectionCount:after.sectionCount}};
}
