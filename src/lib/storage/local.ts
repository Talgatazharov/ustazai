import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';

export type AllowedMime='application/pdf'|'application/vnd.openxmlformats-officedocument.wordprocessingml.document'|'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'|'image/png'|'image/jpeg'|'text/csv';
const extensions:Record<AllowedMime,string>={'application/pdf':'pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx','image/png':'png','image/jpeg':'jpg','text/csv':'csv'};
export function maxUploadSize(){const configured=Number(process.env.MAX_UPLOAD_SIZE||10485760);return Number.isFinite(configured)&&configured>0?configured:10485760;}
async function sniff(bytes:Buffer):Promise<AllowedMime|null>{
  if(bytes.subarray(0,4).toString()==='%PDF')return 'application/pdf';
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes.subarray(0,4).equals(Buffer.from([80,75,3,4]))){try{const zip=await JSZip.loadAsync(bytes);if(zip.file('word/document.xml')&&zip.file('[Content_Types].xml'))return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';if(zip.file('xl/workbook.xml')&&zip.file('[Content_Types].xml'))return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';}catch{return null;}}
  if(bytes.length&&bytes.length<maxUploadSize()&&!bytes.includes(0)){const text=bytes.toString('utf8');if(!text.includes('�')&&/[,;\n]/.test(text))return 'text/csv';}
  return null;
}
function root(){return path.resolve(process.cwd(),process.env.STORAGE_PATH||'uploads/private');}
export async function savePrivateFile(ownerId:string,originalName:string,bytes:Buffer){
  if(bytes.length===0||bytes.length>maxUploadSize())throw new Error(`Файл көлемі ${Math.round(maxUploadSize()/1048576)} МБ шегінен аспауы керек.`);
  const mimeType=await sniff(bytes);if(!mimeType)throw new Error('Файл форматы қолдау көрсетілмейді немесе мазмұны дұрыс емес.');
  const extension=path.extname(originalName).slice(1).toLowerCase();const expected=extensions[mimeType];if(extension!==expected&&!(mimeType==='image/jpeg'&&extension==='jpeg'))throw new Error('Файл атауы мен мазмұны сәйкес емес.');
  const key=`${randomUUID()}.${expected}`;const folder=path.join(root(),ownerId);await fs.mkdir(folder,{recursive:true});await fs.writeFile(path.join(folder,key),bytes,{flag:'wx',mode:0o600});
  return {storageKey:key,originalName:path.basename(originalName).slice(0,200),mimeType,size:bytes.length};
}
export async function readPrivateFile(ownerId:string,key:string){if(!/^[a-f0-9-]{36}\.(pdf|docx|xlsx|png|jpg|csv)$/.test(key))throw new Error('Файл табылмады.');return fs.readFile(path.join(root(),ownerId,key));}
