import express,{type Request,type Response,type NextFunction} from 'express';
import multer from 'multer';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {z} from 'zod';
import {CreateInvestigation,AddText,AnswerInput,type Evidence,type Job,type Mode,type Analysis} from '@tracelens/shared';
import {Store} from './store.js';
import {Ollama,isGemma4,type ModelProvider} from './model.js';
import {analyze} from './engine.js';
import {enrich,detectKind,validateName,redact} from './parsers.js';
import {testResult} from './test-provider.js';
export function createApp(store:Store,provider:ModelProvider=new Ollama()) {
  const app=express();app.disable('x-powered-by');app.use(express.json({limit:'11mb'}));
  const jobs=new Map<string,Job>();const controllers=new Map<string,AbortController>();
  const active=(id:string)=>[...jobs.values()].find(j=>j.investigationId===id&&j.status==='running');
  const model=()=>store.setting('model')||process.env.OLLAMA_MODEL||'gemma4:e4b';
  const asyncRoute=(fn:(req:Request,res:Response)=>Promise<any>|any)=>(req:Request,res:Response,next:NextFunction)=>Promise.resolve().then(()=>fn(req,res)).catch(next);
  app.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');const origin=req.headers.origin;if(!['GET','HEAD','OPTIONS'].includes(req.method)&&origin){const u=new URL(origin);if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname))return res.status(403).json({error:'Only local browser origins may mutate TraceLens data.'});}next();});
  app.get('/api/health',(_req,res)=>res.json({status:'ok',provider:(process.env.TRACELENS_TEST_PROVIDER==='1'||process.env.STATEGHOST_TEST_PROVIDER==='1')?'test':'ollama',storage:'SQLite'}));
  app.get('/api/model/status',asyncRoute(async(_req,res)=>res.json(await provider.status(model()))));
  app.post('/api/model/test',asyncRoute(async(req,res)=>{
    const selected=z.object({model:z.string().optional()}).parse(req.body||{}).model||model();if(!isGemma4(selected))throw new Error('Select an installed local Gemma 4 model.');
    const status=await provider.status(selected);
    if(status.available)store.setting('model',selected);
    if(status.available&&req.body?.inference===true) {const start=Date.now();await provider.generate(z.object({ok:z.boolean()}),'Connection test. Return {"ok":true}.',selected,AbortSignal.timeout(180000));return res.json({...status,message:`Real local inference completed in ${Date.now()-start} ms.`});}
    res.json(status);
  }));
  app.get('/api/investigations',(_req,res)=>res.json(store.list()));
  app.post('/api/investigations',asyncRoute((req,res)=>{const v=CreateInvestigation.parse(req.body);res.status(201).json(store.create(v.title,v.mode));}));
  app.param('id',(req,res,next,id)=>{if(!store.get(id))return res.status(404).json({error:'Investigation not found.'});next();});
  app.get('/api/investigations/:id', (req,res)=>res.json(store.get(req.params.id)));
  app.delete('/api/investigations/:id', (req,res)=>{const job=active(req.params.id);if(job){controllers.get(job.id)?.abort();job.status='cancelled';job.stage='Cancelled';}store.delete(req.params.id);res.status(204).end();});
  const ensureUnlocked=(id:string)=>{if(active(id))throw new Error('Analysis is running. Cancel it before changing evidence or recording a result.');};
  const upload=multer({storage:multer.memoryStorage(),preservePath:true,limits:{fileSize:10*1024*1024,files:1,fields:8,fieldSize:10*1024*1024}});
  app.post('/api/investigations/:id/evidence',upload.single('file'),asyncRoute(async(req,res)=>{
    ensureUnlocked(req.params.id);const inv=store.get(req.params.id)!;
    if(inv.sample)throw new Error('Recorded samples are read-only. Create a live investigation to add evidence.');
    if(inv.evidence.length>=12)throw new Error('Limit: 12 evidence items per investigation.');
    let input;let buffer:Buffer|undefined;let mime='text/plain';
    if(req.file) {validateName(req.file.originalname);buffer=req.file.buffer;input={displayName:req.file.originalname,kind:detectKind(req.file.originalname),sourceLabel:z.string().max(100).parse(req.body.sourceLabel||'Developer supplied'),userTimestamp:req.body.userTimestamp||undefined,content:''};}
    else {input=AddText.parse(req.body);validateName(input.displayName);}
    const bytes=buffer?.length||Buffer.byteLength(input.content);if(bytes>10*1024*1024||inv.evidence.reduce((n,e)=>n+e.bytes,0)+bytes>30*1024*1024)throw new Error('Upload limit: 10 MB per item and 30 MB per investigation.');
    const e:Evidence={...input,kind:input.kind as Evidence['kind'],id:randomUUID(),investigationId:inv.id,uploadedAt:new Date().toISOString(),bytes,mime,entries:[],observations:[],warnings:[],report:{accepted:1,parsedEntries:0,excluded:[],truncation:[]}};
    if(e.kind==='image') {
      if(!buffer)throw new Error('Screenshots must be uploaded as image files.');
      const info=await sharp(buffer,{limitInputPixels:25_000_000}).metadata();if(!['png','jpeg','webp'].includes(info.format||''))throw new Error('Image content must be PNG, JPEG, or WebP.');
      if((info.format==='png'&&!/\.png$/i.test(e.displayName))||(info.format==='jpeg'&&!/\.jpe?g$/i.test(e.displayName))||(info.format==='webp'&&!/\.webp$/i.test(e.displayName)))throw new Error('Image extension does not match its content.');
      buffer=await sharp(buffer,{limitInputPixels:25_000_000}).rotate().png().toBuffer();e.mime='image/png';e.warnings.push('Review/crop/obscure sensitive regions before analysis. Image metadata removed.');
    } else {
      if(buffer){if(buffer.includes(0)||buffer.subarray(0,2).equals(Buffer.from('MZ'))||buffer.subarray(0,2).equals(Buffer.from('#!')))throw new Error('Binary files and executable scripts are not accepted.');e.content=new TextDecoder('utf-8',{fatal:true}).decode(buffer);}
      enrich(e);buffer=Buffer.from(e.content);
    }
    writeFileSync(path.join(store.dir,'evidence',e.id),buffer!);store.addEvidence(e);res.status(201).json(e);
  }));
  app.get('/api/investigations/:id/evidence/:eid/file',(req,res)=>{const e=store.get(req.params.id)!.evidence.find(e=>e.id===req.params.eid);if(!e)return res.status(404).json({error:'Evidence not found.'});res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");res.type(e.mime);res.sendFile(path.join(store.dir,'evidence',e.id));});
  app.patch('/api/investigations/:id/evidence/:eid/observations',asyncRoute((req,res)=>{ensureUnlocked(req.params.id);const e=store.get(req.params.id)!.evidence.find(e=>e.id===req.params.eid);if(!e) return res.status(404).json({error:'Evidence not found.'});const v=z.object({observations:z.array(z.object({id:z.string(),statement:z.string().min(1).max(3000),verification:z.enum(['confirmed','corrected'])})).max(36)}).parse(req.body);for(const o of v.observations){const current=e.observations.find(c=>c.id===o.id);if(!current)throw new Error('Unknown observation.');current.statement=redact(o.statement);current.verification=o.verification;}store.updateEvidence(e);res.json(e);}));
  app.delete('/api/investigations/:id/evidence/:eid',asyncRoute((req,res)=>{ensureUnlocked(req.params.id);store.removeEvidence(req.params.id,req.params.eid);store.db.prepare('DELETE FROM analyses WHERE investigationId=?').run(req.params.id);res.status(204).end();}));
  const startJob=(id:string)=>{
    ensureUnlocked(id);if(store.get(id)!.sample)throw new Error('Sample investigation — recorded example. Create a new investigation for live analysis.');
    const job:Job={id:randomUUID(),investigationId:id,status:'running',stage:'Reading evidence',startedAt:new Date().toISOString()};const controller=new AbortController();jobs.set(job.id,job);controllers.set(job.id,controller);
    const timer=setTimeout(()=>controller.abort(new Error('Analysis timed out. Reduce evidence or increase OLLAMA_TIMEOUT_MS.')),Number(process.env.OLLAMA_TIMEOUT_MS||180000));
    void analyze(store,id,provider,model(),controller.signal,s=>{job.stage=s;}).then(a=>{if(!controller.signal.aborted){job.status='completed';job.analysisId=a.id;job.stage='Completed';}}).catch(error=>{job.status=controller.signal.aborted?'cancelled':'failed';job.error=controller.signal.aborted?String(controller.signal.reason?.message||'Analysis cancelled. No diagnosis revision saved.'):String(error.message||error);job.stage=job.status==='cancelled'?'Cancelled':'Analysis failed';}).finally(()=>{clearTimeout(timer);controllers.delete(job.id);});
    return job;
  };
  app.post('/api/investigations/:id/analyze',asyncRoute((req,res)=>res.status(202).json(startJob(req.params.id))));
  app.get('/api/investigations/:id/jobs/:jid',(req,res)=>{const job=jobs.get(req.params.jid);if(!job||job.investigationId!==req.params.id)return res.status(404).json({error:'Job not found. The server may have restarted; saved revisions are preserved.'});res.json(job);});
  app.post('/api/investigations/:id/jobs/:jid/cancel',(req,res)=>{const job=jobs.get(req.params.jid);if(!job||job.investigationId!==req.params.id)return res.status(404).json({error:'Job not found.'});controllers.get(job.id)?.abort(new Error('Analysis cancelled by user.'));res.json({cancelled:true});});
  for(const [route,kind] of [['answers','answer'],['test-results','test']] as const)app.post(`/api/investigations/:id/${route}`,asyncRoute((req,res)=>{
    ensureUnlocked(req.params.id);const input=AnswerInput.parse(req.body);const inv=store.get(req.params.id)!;const latest=inv.analyses.at(-1);if(!latest)throw new Error('Run an initial analysis first.');if(kind==='answer'&&input.questionId!==latest.nextQuestion.id)throw new Error('Answer the latest revision’s question.');if(kind==='test'&&!latest.hypotheses.some(h=>h.id===input.hypothesisId))throw new Error('Unknown hypothesis for test result.');
    store.addInteraction(inv.id,{...input,text:redact(input.text),id:randomUUID(),kind,createdAt:new Date().toISOString(),basedOnRevision:latest.revision});res.status(202).json(startJob(inv.id));
  }));
  app.get('/api/investigations/:id/export',(req,res)=>{
    const inv=store.get(req.params.id)!;const markdown=req.query.format==='markdown';const ext=markdown?'md':'json';res.attachment(`tracelens-${inv.id}.${ext}`);
    if(!markdown)return res.json({...inv,limitations:['Interpretations are model hypotheses, not confirmed root causes.','Vision observations remain unverified until user confirmation.','Exports include redacted text and image citations; screenshot pixels are retained locally and not embedded.','Cross-machine clock ordering is uncertain.']});
    const text=`# ${inv.title}\n\n${inv.sample?'Sample investigation — recorded example.':'Local investigation.'}\n\nMode: ${inv.mode}\n\n## Evidence\n${inv.evidence.map(e=>`- [${e.id}] ${e.displayName} — ${e.sourceLabel}; uploaded ${e.uploadedAt}; event time ${e.userTimestamp||'not supplied'}\n  Warnings: ${[...e.warnings,...e.report.truncation].join('; ')}`).join('\n')}\n\n${inv.analyses.map(a=>`## Revision ${a.revision}\n${a.summary}\n\n${a.observations.map(o=>`- ${o.id}: ${o.statement} (${o.origin}, ${o.verification}) ${o.evidenceRefs.map(r=>`[${r.evidenceId}: ${r.locator}${r.region?` / ${r.region}`:''}]`).join(' ')}`).join('\n')}\n\n${a.hypotheses.map(h=>`### ${h.title} — ${h.status}, ${h.evidenceStrength}\n${h.explanation}\nSupport: ${h.supportingObservationIds.join(', ')}\nCounterevidence: ${h.contradictingObservationIds.join(', ')||'None supplied'}\nTest: ${h.distinguishingTest.action}\n${h.distinguishingTest.expectedOutcomes.map((o,i)=>`- ${o}: ${h.distinguishingTest.interpretationForEachOutcome[i]}`).join('\n')}`).join('\n\n')}\nMissing: ${a.missingEvidence.join('; ')}\nQuestion: ${a.nextQuestion.question}\nWhy: ${a.nextQuestion.whyUseful}\nChanged: ${a.changes}\nModel metadata: ${JSON.stringify(a.modelMetadata)}`).join('\n\n')}\n\n## User reports\n${inv.interactions.map(i=>`- ${i.createdAt} / revision ${i.basedOnRevision} / ${i.kind}: ${i.text}`).join('\n')}\n\n## Limitations\nHypotheses are interpretations. User reports and vision extractions are not independently verified. Clock order across machines is uncertain. Screenshots are cited but not embedded. Review redactions before sharing.\n`;res.type('text/markdown').send(text);
  });
  app.post('/api/samples',asyncRoute((_req,res)=>{
    const inv=store.create('Two tabs, two cart totals','state',true);const e:Evidence={id:randomUUID(),investigationId:inv.id,displayName:'browser.log',kind:'log',sourceLabel:'Recorded example',uploadedAt:new Date().toISOString(),bytes:180,mime:'text/plain',content:'Tab A UI total: 4200 minor units.\nTab B UI total: 2400 minor units.\nRefreshing Tab B changes its total to 4200.\nSame demo origin and cart key were reported by the recorder.',entries:[],observations:[],warnings:['Sample investigation — recorded example. Not live model output.'],report:{accepted:1,parsedEntries:0,excluded:[],truncation:[]}};enrich(e);writeFileSync(path.join(store.dir,'evidence',e.id),e.content);store.addEvidence(e);
    const a:Analysis={...testResult(e.observations),id:randomUUID(),revision:1,summary:'Sample investigation — recorded example. Two tabs show different cart totals, and the recorded refresh brings Tab B into agreement. Stale memory is a plausible explanation; check account and storage evidence before concluding.',observations:e.observations,modeSpecificResults:{timeline:[],setupDifferences:[]},modelMetadata:{model:'recorded-example',timestamp:'2026-10-01T10:00:00Z',durationMs:0,provider:'recorded'}};a.hypotheses[0].explanation='A tab may hold a snapshot of the cart while another tab changes storage. The recorded refresh is consistent with this, but account differences or timing need to be ruled out.';store.addAnalysis(inv.id,a);res.status(201).json(store.get(inv.id));
  }));
  const demoEvents:any[]=[];
  app.post('/api/demo/order',(req,res)=>{const requestId=z.string().max(100).parse(req.body.requestId||randomUUID());const event={timestamp:new Date().toISOString(),event:'backend.order.failed',requestId,status:500,message:'Demo inventory service unavailable'};demoEvents.push(event);if(demoEvents.length>100)demoEvents.shift();res.setHeader('X-Request-ID',requestId);res.status(500).json({error:event.message,requestId});});
  app.get('/api/demo/logs',(_req,res)=>res.json(demoEvents));
  app.post('/api/demo/reset',(_req,res)=>{demoEvents.length=0;res.json({ok:true});});
  app.use((error:any,_req:Request,res:Response,_next:NextFunction)=>{const status=error instanceof z.ZodError||error instanceof SyntaxError||error instanceof multer.MulterError?400:422;res.status(status).json({error:error instanceof z.ZodError?error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; '):error.message||'Request failed.'});});
  return app;
}
