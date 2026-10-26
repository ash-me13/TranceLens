import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {ModelResult,VisionResult,type Analysis,type InvestigationDetail,type ModelMetadata,type Observation,type Ref} from '@tracelens/shared';
import {boundedContent,compareSetup,timeline} from './parsers.js';
import type {ModelProvider} from './model.js';
import type {Store} from './store.js';
export function validateResult(result:ModelResult,investigation:InvestigationDetail,observations:Observation[]) {
  const observationIds=new Set(observations.map(o=>o.id));
  const hIds=new Set(result.hypotheses.map(h=>h.id));
  if(hIds.size!==result.hypotheses.length)throw new Error('Duplicate hypothesis IDs.');
  const resolveRef=(ref:Ref)=>{
    const e=investigation.evidence.find(e=>e.id===ref.evidenceId);if(!e)throw new Error(`Unknown evidence reference ${ref.evidenceId}`);
    if(ref.line&&ref.line>e.content.split('\n').length)throw new Error(`Invented source line ${ref.line}`);
    if(ref.entry!==undefined&&!e.entries.some(h=>h.index===ref.entry))throw new Error('Unknown HAR entry');
    if(e.kind==='image'&&!ref.region)throw new Error('Screenshot citations require a descriptive region.');
  };
  for(const o of observations)o.evidenceRefs.forEach(resolveRef);
  const resolveObsId=(id:string)=>{
    if(observationIds.has(id)) return id;
    const clean=id.replace(/^o-(?:ev-)?/,'');
    const found=[...observationIds].find(o=>o.replace(/^o-(?:ev-)?/,'')===clean||o.endsWith(clean));
    if(found) return found;
    throw new Error(`Unknown observation ${id}`);
  };
  result.summaryObservationIds=result.summaryObservationIds.map(resolveObsId);
  for(const h of result.hypotheses){
    h.supportingObservationIds=h.supportingObservationIds.map(resolveObsId);
    h.contradictingObservationIds=h.contradictingObservationIds.map(resolveObsId);
  }
  if(result.hypotheses.some(h=>!h.supportingObservationIds.length&&h.evidenceStrength!=='low'))throw new Error('An unsupported hypothesis must have low evidence strength.');
  for(const id of result.nextQuestion.affectedHypothesisIds)if(!hIds.has(id))throw new Error(`Unknown affected hypothesis ${id}`);
  const nodes=new Set(result.stateGraph.nodes.map(n=>n.id));
  if(nodes.size!==result.stateGraph.nodes.length)throw new Error('Duplicate graph node IDs');
  for(const item of [...result.stateGraph.nodes,...result.stateGraph.edges]) {item.evidenceRefs.forEach(resolveRef);if(item.kind==='observed'&&!item.evidenceRefs.length)throw new Error('Observed graph claims need evidence.');}
  for(const edge of result.stateGraph.edges)if(!nodes.has(edge.source)||!nodes.has(edge.target))throw new Error('Unknown graph endpoint');
  if(!observations.length&&(result.hypotheses.length||!result.missingEvidence.length))throw new Error('Without observations, request evidence and do not diagnose.');
}
export async function analyze(store:Store,id:string,provider:ModelProvider,model:string,signal:AbortSignal,stage:(s:string)=>void):Promise<Analysis> {
  const started=Date.now();const snapshot=store.get(id)!;
  const status=await provider.status(model,signal);signal.throwIfAborted();
  if(!status.available)throw new Error(status.message);
  if(snapshot.evidence.some(e=>e.kind==='image')&&!status.imageInput)throw new Error('Selected Gemma 4 model does not report image-input capability. Select an installed vision-capable Gemma 4 model or remove screenshots.');
  stage('Reading evidence');
  let observations=snapshot.evidence.flatMap(e=>e.observations);
  if(snapshot.evidence.some(e=>e.kind==='image'&&!e.observations.length))stage('Analyzing screenshots');
  for(const e of snapshot.evidence.filter(e=>e.kind==='image'&&!e.observations.length)) {
    signal.throwIfAborted();
    const response=await provider.generate(VisionResult,`Extract visible UI text and visual facts only from this screenshot. Label: ${JSON.stringify(e.sourceLabel)}. Do not infer accounts, time, success, or shared sessions. For each fact describe the region in words, never bounding boxes.`,model,signal,[readFileSync(path.join(store.dir,'evidence',e.id)).toString('base64')]);
    e.observations=response.result.observations.map((o,index)=>({id:`o-${e.id}-${index}`,statement:o.statement,origin:'vision',verification:'unverified',evidenceRefs:[{evidenceId:e.id,locator:'screenshot',region:o.region}]}));
    signal.throwIfAborted();store.updateEvidence(e);observations.push(...e.observations);
  }
  const previous=snapshot.analyses.at(-1);
  const interactions=snapshot.interactions.map(i=>({...i,description:'User-reported information; not independently verified.'}));
  const modeSpecificResults={timeline:timeline(snapshot.evidence),setupDifferences:compareSetup(snapshot.evidence)};
  const selected=observations.slice(0,180); // Stable IDs and an explicit budget notice.
  const context=JSON.stringify({mode:snapshot.mode,title:snapshot.title,evidence:snapshot.evidence.map(e=>({id:e.id,name:e.displayName,label:e.sourceLabel,userTimestamp:e.userTimestamp,uploadedAt:e.uploadedAt,content:boundedContent(e),warnings:e.warnings})),observations:selected,contextLimit:`Using ${selected.length} of ${observations.length} observations. Source excerpts are bounded; omitted content is not evidence of absence.`,deterministicResults:modeSpecificResults,previous:previous?{hypotheses:previous.hypotheses,summary:previous.summary}:null,userReports:interactions,instructions:'Produce competing hypotheses, using the supplied observation IDs for support and counterevidence. Retain previous hypothesis IDs for the same underlying explanation. User reports can support, weaken, contradict or leave unchanged. Explain what changed. Do not invent observations. summaryObservationIds must cite the case-specific summary. Use empty hypotheses and request evidence when insufficient. Include one useful next question. State mode: graph edges/nodes must distinguish observed, inferred and unknown; never mark a storage/API layer observed without direct evidence. Other modes can use an empty graph. Do not use upload time as event time. No ground truth is supplied.'});
  if(context.length>240000)throw new Error('Evidence context exceeds the analysis budget. Remove large inputs or split this investigation. No silent truncation was applied.');
  stage('Comparing explanations');
  const {result,stats}=await provider.generate(ModelResult,context,model,signal,[],r=>validateResult(r,snapshot,selected));
  stage('Validating results');signal.throwIfAborted();
  // Normalize repeat hypothesis identity by title, while preserving explicit reused IDs.
  const mapping=new Map<string,string>();
  result.hypotheses.forEach(h=>{const match=previous?.hypotheses.find(p=>p.id===h.id||p.title.toLowerCase().trim()===h.title.toLowerCase().trim());mapping.set(h.id,match?.id||`h-${createHash('sha256').update(h.title.toLowerCase().trim()).digest('hex').slice(0,10)}`);});
  result.hypotheses=result.hypotheses.map(h=>({...h,id:mapping.get(h.id)!}));result.nextQuestion.affectedHypothesisIds=result.nextQuestion.affectedHypothesisIds.map(id=>mapping.get(id)!);
  const modelMetadata:ModelMetadata={model,timestamp:new Date().toISOString(),durationMs:Date.now()-started,...stats,provider:(process.env.TRACELENS_TEST_PROVIDER==='1'||process.env.STATEGHOST_TEST_PROVIDER==='1')?'test':'ollama'};
  const analysis:Analysis={...result,id:randomUUID(),revision:(previous?.revision||0)+1,observations:selected,modeSpecificResults,modelMetadata};
  signal.throwIfAborted();store.addAnalysis(id,analysis);return analysis;
}
