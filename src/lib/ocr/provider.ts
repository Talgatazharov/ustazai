import 'server-only';
import JSZip from 'jszip';
import OpenAI from 'openai';
import { z } from 'zod';
import type { AllowedMime } from '@/lib/storage/local';
import { AI_CONFIG } from '@/config/ai.config';
import { mapAIError } from '@/lib/ai/provider';

export type OCRPage={pageNumber:number;rawText:string;structuredText:string;confidence:number;warnings:string[]};
export interface OCRProvider {name:string;extractText(bytes:Buffer,mime:AllowedMime):Promise<OCRPage[]>;extractPages(bytes:Buffer,mime:AllowedMime):Promise<OCRPage[]>;analyzeHandwriting(bytes:Buffer,mime:AllowedMime):Promise<OCRPage[]>;}
function normalizeXmlText(xml:string){return xml.replace(/<w:tab\b[^>]*\/?\s*>/g,'\t').replace(/<w:br\b[^>]*\/?\s*>/g,'\n').replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();}
export const mockOCRProvider:OCRProvider={
  name:'Демо OCR',
  async extractText(bytes,mime){if(mime==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'){const zip=await JSZip.loadAsync(bytes);const xml=await zip.file('word/document.xml')?.async('string');const text=xml?normalizeXmlText(xml):'';return [{pageNumber:1,rawText:text,structuredText:text,confidence:text?90:0,warnings:text?[]:['DOCX мәтіні оқылмады.']}];}if(mime==='text/csv'){const text=bytes.toString('utf8');return [{pageNumber:1,rawText:text,structuredText:text,confidence:95,warnings:[]}];}return [{pageNumber:1,rawText:'',structuredText:'',confidence:0,warnings:['Бұл файл үшін нақты OCR сервисі қосылмаған. Мәтінді қолмен енгізіңіз.']}];},
  async extractPages(bytes,mime){return this.extractText(bytes,mime);},
  async analyzeHandwriting(bytes,mime){return this.extractText(bytes,mime);}
};
const visionSchema=z.object({pages:z.array(z.object({pageNumber:z.number().int(),rawText:z.string(),confidence:z.number().min(0).max(100),warnings:z.array(z.string())})).min(1)});
class OpenAIVisionProvider implements OCRProvider{
  name='OpenAI Vision';
  constructor(private apiKey:string,private model:string){}
  async extractText(bytes:Buffer,mime:AllowedMime){
    if(!mime.startsWith('image/')&&mime!=='application/pdf')return mockOCRProvider.extractText(bytes,mime);
    try{
      const data=`data:${mime};base64,${bytes.toString('base64')}`;
      const client=new OpenAI({apiKey:this.apiKey,timeout:30000,maxRetries:2});
      const response=await client.chat.completions.create({
        model:this.model,
        response_format:{type:'json_object'},
        messages:[
          {
            role:'system',
            content:'Оқушы жұмысындағы қолжазба мен баспа мәтінді дәл оқы. Барлық беттерді ретімен өңде. Болжам жасама. Сенімсіз жерлерді warning ретінде көрсет. Жауап тек мына JSON құрылымында болуы керек: {"pages":[{"pageNumber":1,"rawText":"оқылған мәтін","confidence":90,"warnings":[]}]}'
          },
          {
            role:'user',
            content:[
              {type:'text',text:'Оқушы жұмысындағы барлық мәтінді толық оқып бер. Сенімділік бағасын 0 мен 100 аралығында көрсет.'},
              {type:'image_url',image_url:{url:data,detail:'high'}}
            ]
          }
        ]
      });
      const rawContent=response.choices[0]?.message?.content||'{}';
      const parsed=visionSchema.parse(JSON.parse(rawContent));
      return parsed.pages.map(page=>({...page,structuredText:page.rawText}));
    }catch(error){
      throw mapAIError(error,this.model);
    }
  }
  async extractPages(bytes:Buffer,mime:AllowedMime){return this.extractText(bytes,mime);}
  async analyzeHandwriting(bytes:Buffer,mime:AllowedMime){return this.extractText(bytes,mime);}
}
export type OCRRequestConfig={provider?:string;apiKey?:string;model?:string};
export function getOCRRequestConfig(request?:Request):Required<OCRRequestConfig>{return {provider:request?.headers.get('x-ocr-provider')||process.env.OCR_PROVIDER||AI_CONFIG.ocrProvider,apiKey:request?.headers.get('x-ocr-key')||process.env.OCR_API_KEY||process.env.AI_API_KEY||AI_CONFIG.ocrApiKey||AI_CONFIG.apiKey,model:request?.headers.get('x-vision-model')||process.env.OCR_MODEL||AI_CONFIG.visionModel};}
export function getOCRProvider(config:OCRRequestConfig={}):OCRProvider{const resolved={provider:config.provider||process.env.OCR_PROVIDER||AI_CONFIG.ocrProvider,apiKey:config.apiKey||process.env.OCR_API_KEY||process.env.AI_API_KEY||AI_CONFIG.ocrApiKey||AI_CONFIG.apiKey,model:config.model||process.env.OCR_MODEL||AI_CONFIG.visionModel};if(resolved.provider==='mock'||!resolved.apiKey)return mockOCRProvider;if(resolved.provider==='openai')return new OpenAIVisionProvider(resolved.apiKey,resolved.model);throw new Error('OCR provider конфигурациясы қолдау көрсетілмейді.');}
