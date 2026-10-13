import 'server-only';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';

export type ImportRow={row:number;name:string;status:'ready'|'duplicate'|'invalid';reason?:string};
const normalize=(value:string)=>value.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('kk');
export async function parseStudentFile(filename:string,bytes:Buffer):Promise<string[]>{
  if(bytes.length>5*1024*1024)throw new Error('Файл 5 МБ-тан аспауы тиіс.');
  const ext=filename.toLowerCase().split('.').pop();
  if(ext==='csv'){
    const raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    const records=parse(raw,{bom:true,skip_empty_lines:true,relax_column_count:true}) as string[][];
    return records.map(row=>String(row[0]??''));
  }
  if(ext==='xlsx'){
    if(bytes[0]!==0x50||bytes[1]!==0x4b)throw new Error('XLSX файл пішімі қате.');
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const sheet=workbook.worksheets[0];if(!sheet)throw new Error('Excel парағы бос.');
    const names:string[]=[];sheet.eachRow({includeEmpty:false},row=>{names.push(String(row.getCell(1).text??''));});return names;
  }
  throw new Error('CSV немесе XLSX файлын таңдаңыз.');
}
export function previewStudentNames(names:string[],existing:string[]):ImportRow[]{
  const seen=new Set(existing.map(normalize));
  const rows:ImportRow[]=[];
  names.forEach((raw,index)=>{
    const name=raw.trim().replace(/\s+/g,' ');
    if(index===0&&['аты-жөні','аты жөні','оқушы','name','full name'].includes(normalize(name)))return;
    if(name.length<2||name.length>120){rows.push({row:index+1,name,status:'invalid',reason:'Аты-жөні 2–120 таңба болуы керек.'});return;}
    const key=normalize(name);if(seen.has(key)){rows.push({row:index+1,name,status:'duplicate',reason:'Қайталанған оқушы.'});return;}
    seen.add(key);rows.push({row:index+1,name,status:'ready'});
  });
  return rows;
}
