import {z} from 'zod';
import {zodToJsonSchema} from 'zod-to-json-schema';
import type {ModelStatus} from '@tracelens/shared';
import {SYSTEM_INSTRUCTION} from '@tracelens/shared';
export interface ModelProvider {
  status(model:string,signal?:AbortSignal):Promise<ModelStatus>;
  generate<T>(schema:z.ZodType<T>,context:string,model:string,signal:AbortSignal,images?:string[],validate?:(result:T)=>void):Promise<{result:T;stats:{promptTokens?:number;completionTokens?:number;totalDurationNs?:number}}>;
}
export function isGemma4(name:string) {return /^(?:[^/]+\/)?gemma[-_]?4(?::|$)/i.test(name);}
export class Ollama implements ModelProvider {
  base:string;timeout:number;
  constructor(base=process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434',timeout=Number(process.env.OLLAMA_TIMEOUT_MS||180000)) {
    const url=new URL(base);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!['http:','https:'].includes(url.protocol))throw new Error('OLLAMA_BASE_URL must point to a local loopback Ollama instance.');
    this.base=base.replace(/\/$/,'');this.timeout=timeout;
  }
  async json(endpoint:string,body?:unknown,signal?:AbortSignal) {
    const res=await fetch(this.base+endpoint,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.any([signal||new AbortController().signal,AbortSignal.timeout(endpoint==='/api/chat'?this.timeout:6000)])});
    if(!res.ok)throw new Error(`Ollama ${endpoint}: HTTP ${res.status}. ${String(await res.text()).slice(0,400)}`);
    return res.json() as Promise<any>;
  }
  async status(model:string,signal?:AbortSignal):Promise<ModelStatus> {
    const base={selectedModel:model,models:[] as string[],imageInput:false,available:false,capabilities:[] as string[]};
    try {
      const tags=await this.json('/api/tags',undefined,signal);const models=(tags.models||[]).map((m:any)=>m.name).filter(isGemma4);
      if(!isGemma4(model)||!models.includes(model))return {...base,models,connected:true,message:`Selected local Gemma 4 model is unavailable. Run ollama pull ${model}.`};
      const show=await this.json('/api/show',{model},signal);const capabilities=Array.isArray(show.capabilities)?show.capabilities:[];
      return {...base,connected:true,models,available:true,imageInput:capabilities.includes('vision'),capabilities,message:'Local Ollama connected. Model capabilities inspected with /api/show.'};
    }catch(error){return {...base,connected:false,message:`Cannot connect to local Ollama at ${this.base}. Start ollama serve. ${error instanceof Error?error.message:String(error)}`};}
  }
  async generate<T>(schema:z.ZodType<T>,context:string,model:string,signal:AbortSignal,images:string[]=[],validate?:(result:T)=>void) {
    const messages:any[]=[{role:'system',content:SYSTEM_INSTRUCTION},{role:'user',content:context,...(images.length?{images}:{})}];
    let lastError='';
    for(let attempt=0;attempt<2;attempt++) {
      signal.throwIfAborted();
      const response=await this.json('/api/chat',{model,messages,stream:false,format:zodToJsonSchema(schema,{$refStrategy:'none'}),options:{temperature:0.1,num_ctx:16384,num_predict:2500}},signal);
      const content=response.message?.content||'';
      try {const result=schema.parse(JSON.parse(content));validate?.(result);return {result,stats:{promptTokens:response.prompt_eval_count,completionTokens:response.eval_count,totalDurationNs:response.total_duration}};}
      catch(error){lastError=error instanceof Error?error.message:String(error);if(attempt===0)messages.push({role:'assistant',content},{role:'user',content:`Your output failed validation: ${lastError.slice(0,2500)}. Repair the JSON once. Use only supplied references and observation IDs. Return the complete corrected object.`});}
    }
    throw new Error(`The local model returned invalid structured results after one repair attempt. Nothing was saved as a diagnosis. Retry with less evidence. Validation: ${lastError.slice(0,700)}`);
  }
}
