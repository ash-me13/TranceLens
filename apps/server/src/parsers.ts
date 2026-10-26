import {createHash} from 'node:crypto';
import semver from 'semver';
import {parse as parseYaml} from 'yaml';
import type {Evidence, EvidenceKind, Observation, Ref, SetupDifference, TimelineEvent, HarEntry} from '@tracelens/shared';
export const secretKey = /authorization|cookie|token|secret|password|passwd|api[-_]?key|credential/i;
export function redact(text:string, env=false):string {
  if(env) return text.split('\n').map(l=>l.replace(/^(\s*(?:export\s+)?[A-Za-z_][\w]*\s*=)(.*)$/,(_,key,value)=>`${key}${value.trim()&&value.trim()!=='[missing]'?'[present; value redacted]':'[missing]'}`)).join('\n');
  return text
    .replace(/((?:authorization|set-cookie|cookie|[\w-]*(?:token|secret|password|api[_-]?key)[\w-]*)["']?\s*[:=]\s*(?:Bearer\s+)?)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;}\n]+)/gi,
      (_, prefix) => `${prefix}"[REDACTED]"`.replace(/:\s*(?:Bearer\s+)"\[REDACTED\]"/i, ': Bearer [REDACTED]').replace(/(["'])\s*"\s*\[REDACTED\]"/, '$1"[REDACTED]"'))
    .replace(/(Bearer\s+)(?!\[REDACTED\])[\w.\-+/=]+/gi,'$1[REDACTED]')
    .replace(/([?&](?:[^=&]*(?:token|key|secret|password)[^=&]*)=)[^&#\s"]*/gi,'$1[REDACTED]')
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{15,}|AKIA[A-Z0-9]{16})\b/g,'[REDACTED]')
    .replace(/\b([A-Z][A-Z0-9_]{2,})\s*=\s*(?!\[REDACTED\])([^\s\n]+)/g,'$1=[REDACTED]');
}
function cleanObject(value:unknown):unknown {
  if(Array.isArray(value)) return value.map(cleanObject);
  if(value&&typeof value==='object') {
    const obj=value as Record<string,unknown>;
    if(typeof obj.name==='string'&&secretKey.test(obj.name)&&'value' in obj) return {...obj,value:'[REDACTED]'};
    return Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,secretKey.test(k)?'[REDACTED]':cleanObject(v)]));
  }
  if(typeof value==='string') return redact(value);
  return value;
}
export function parseHar(raw:string):{content:string;entries:HarEntry[];warnings:string[]} {
  const json=JSON.parse(raw);
  if(!json?.log||!Array.isArray(json.log.entries)) throw new Error('Invalid HAR: expected log.entries array.');
  if(json.log.entries.some((e:any)=>!e.request||typeof e.request.url!=='string'||!e.response||typeof e.response.status!=='number')) throw new Error('Invalid HAR entry: request URL and numeric response status are required.');
  const clean=cleanObject(json) as typeof json;
  const entries=clean.log.entries.slice(0,500).map((e:any,index:number)=>{
    const headers=[...(e.request.headers||[]),...(e.response.headers||[])];
    const id=headers.find((h:any)=>/^(x-request-id|x-correlation-id|traceparent)$/i.test(h.name));
    return {index,method:String(e.request.method||'UNKNOWN'),url:String(e.request.url),status:e.response.status,duration:Number.isFinite(e.time)?e.time:0,startedDateTime:typeof e.startedDateTime==='string'?e.startedDateTime:'',requestId:id?.value,responseDetails:String(e.response.content?.text||e.response.statusText||'No response body captured').slice(0,4000),error:e._error||e.response._error};
  });
  const warnings=entries.some((e:HarEntry)=>!e.startedDateTime)?['Some HAR entries have no event timestamp. Upload time is never used as event time.']:[];
  if(clean.log.entries.length>500) warnings.push(`Showing first 500 of ${clean.log.entries.length} entries; full redacted HAR retained in source. Remaining entries excluded from model context.`);
  return {content:JSON.stringify(clean,null,2),entries,warnings};
}
export function detectKind(name:string):EvidenceKind {
  if(/\.(png|jpe?g|webp)$/i.test(name)) return 'image';
  if(/\.har$/i.test(name)) return 'har';
  if(name==='package.json') return 'manifest';
  if(/lock|shrinkwrap|yarn\.lock/i.test(name)) return 'lockfile';
  if(/^\.env/i.test(name)) return 'env';
  if(/\.(log|jsonl)$/i.test(name)) return 'log';
  if(/\.(md|txt)$/i.test(name)) return 'instructions';
  return 'source';
}
export function validateName(name:string) {
  if(name.includes('/')||name.includes('\\')||name.includes('..')||name.length>180) throw new Error('Use a simple filename without directory components.');
  if(!/\.(png|jpe?g|webp|har|json|jsonl|log|md|txt|tsx?|jsx?|css|py|go|rs|java|c|cpp|h|ya?ml|toml|lock|example)$/i.test(name)&&!['.env','Dockerfile','.nvmrc'].includes(name)) throw new Error('Unsupported file type. Executables and archives are not accepted.');
}
export function obs(e:Evidence,statement:string,locator='source',extra:Partial<Ref>={}):Observation {
  const suffix = extra.line !== undefined ? `L${extra.line}` : extra.entry !== undefined ? `entry${extra.entry}` : createHash('sha256').update(e.id+statement).digest('hex').slice(0,6);
  return {id:`o-${e.id}-${suffix}`,statement,evidenceRefs:[{evidenceId:e.id,locator,...extra}],origin:'parser',verification:'confirmed'};
}
export function enrich(e:Evidence):Evidence {
  if(e.kind==='image') return e;
  if(e.kind==='har') {
    const parsed=parseHar(e.content); e.content=parsed.content;e.entries=parsed.entries;e.warnings.push(...parsed.warnings);
    e.observations=e.entries.slice(0,40).map(h=>obs(e,`${h.method} ${h.url} returned HTTP ${h.status} in ${h.duration} ms${h.requestId?`; request ID ${h.requestId}`:''}${h.startedDateTime?`; event time ${h.startedDateTime}`:''}.`,`HAR entry ${h.index+1}`,{entry:h.index}));
  } else {
    e.content=redact(e.content,e.kind==='env');
    if(e.kind==='manifest') {const p=JSON.parse(e.content); if(!p||typeof p!=='object'||Array.isArray(p)) throw new Error('package.json must contain an object.');}
    const lines=e.content.split('\n');
    const relevant=lines.map((s,i)=>({s,i})).filter(({s})=>s.trim()&&(/error|fail|saved|loading|request|node|engine|version|required|module|EADDRINUSE|ERESOLVE|storage|useState|setItem|checkout|fetch|dependencies|lockfile|packageManager|^[\w_]+=/.test(s)||e.kind==='runtime'));
    e.observations=(relevant.length?relevant:lines.map((s,i)=>({s,i})).filter(({s})=>s.trim()).slice(0,6)).slice(0,36).map(({s,i})=>obs(e,`Source text: ${s.slice(0,700)}`,`line ${i+1}`,{line:i+1}));
    if(lines.length>180) e.report.truncation.push(`${lines.length} source lines retained. Model context uses head, relevant matches and tail, up to 12,000 characters.`);
    if(e.kind==='lockfile'&&!/^(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml)$/.test(e.displayName)) e.warnings.push('Unsupported lockfile format for consistency checks. Source can still be inspected.');
  }
  e.report.parsedEntries=e.kind==='har'?e.entries.length:e.observations.length;
  e.report.excluded.push('Common secret values redacted locally; review for project-specific secrets.');
  if(e.kind==='har'&&e.entries.length>40) e.report.truncation.push('Only the first 40 HAR entries become observations. Up to 500 are available in the timeline.');
  return e;
}
export function boundedContent(e:Evidence):string {
  if(e.kind==='image') return '(Image supplied to vision extraction; see observations.)';
  if(e.content.length<=12000) return e.content;
  const lines=e.content.split('\n');
  const matches=lines.map((l,i)=>({l,i})).filter(({l})=>/error|fail|storage|fetch|engine|version|lockfile|dependencies|required|loading/i.test(l)).slice(0,25).map(({l,i})=>`L${i+1}: ${l.slice(0,220)}`).join('\n');
  return `${e.content.slice(0,3500)}\n[BOUNDED EXTRACTION: middle omitted; full source retained]\n${matches}\n[TAIL]\n${e.content.slice(-3000)}`.slice(0,12000);
}
function json(e?:Evidence) {try{return JSON.parse(e?.content||'{}')}catch{return {}}}
export function compareSetup(evidence:Evidence[]):SetupDifference[] {
  const results:SetupDifference[]=[];
  const groups=['Working machine','Broken machine'].map(label=>evidence.filter(e=>e.sourceLabel===label));
  const manifests=groups.map(g=>g.find(e=>e.kind==='manifest'));
  const ps=manifests.map(json);
  const refs=(es:(Evidence|undefined)[])=>es.filter((e):e is Evidence=>!!e).map(e=>({evidenceId:e.id,locator:'environment source'}));
  const row=(check:string,working:string,broken:string,severity:SetupDifference['severity'],es:(Evidence|undefined)[])=>results.push({check,working,broken,severity,evidenceRefs:refs(es)});
  for(let i=0;i<2;i++) {
    const label=i===0?'Working':'Broken'; const g=groups[i]; const p=ps[i];
    const runtime=g.find(e=>e.kind==='runtime'||/node\s+v?\d+/.test(e.content));
    const version=runtime?.content.match(/(?:node(?:\.js)?\s*[:=]?\s*v?|^v)(\d+\.\d+\.\d+)/im)?.[1];
    const range=p.engines?.node;
    if(range&&version) row(`${label}: Node engines`,`${version} supplied`,`${range} required; ${semver.validRange(range)?semver.satisfies(version,range)?'compatible':'INCOMPATIBLE':'invalid semver range'}`,semver.validRange(range)&&semver.satisfies(version,range)?'info':'error',[runtime,manifests[i]]);
    else if(range) row(`${label}: Node engines`,'Version missing',`${range} required; cannot verify`,'warning',[manifests[i]]);
    const declared=p.packageManager?.split('@')[0];
    const manager=runtime?.content.match(/\b(npm|pnpm|yarn)\s*[:=]?\s*\d+\.\d+/i)?.[1];
    if(declared) row(`${label}: package manager`,String(p.packageManager),manager?`${manager} supplied${manager!==declared?' — MISMATCH':''}`:'Runtime package manager missing',manager&&manager!==declared?'error':'info',[manifests[i],runtime]);
    const lock=g.find(e=>e.kind==='lockfile');
    if(lock) {
      let lp:any;try{lp=/\.yaml$/.test(lock.displayName)?parseYaml(lock.content,{maxAliasCount:50}):json(lock)}catch{lp={}}
      if(/^(package-lock\.json|npm-shrinkwrap\.json)$/.test(lock.displayName)&&[2,3].includes(lp.lockfileVersion)) {
        const root=lp.packages?.[''];
        if(!root) row(`${label}: manifest / lockfile`,'Manifest supplied','Lockfile root entry missing','warning',[lock,manifests[i]]);
        else if(manifests[i]) {
          const keys=['dependencies','devDependencies','optionalDependencies'];
          const mismatch=keys.flatMap(k=>[...new Set([...Object.keys(p[k]||{}),...Object.keys(root[k]||{})])].filter(d=>p[k]?.[d]!==root[k]?.[d]).map(d=>`${d}: manifest ${p[k]?.[d]??'absent'} / lock ${root[k]?.[d]??'absent'}`));
          row(`${label}: manifest / lockfile`,'npm lockfile v'+lp.lockfileVersion,mismatch.length?mismatch.join('; '):'Root dependency declarations match',mismatch.length?'error':'info',[manifests[i],lock]);
        }
      } else if(lock.displayName==='pnpm-lock.yaml'&&['9.0','6.0'].includes(String(lp.lockfileVersion))) {
        const root=lp.importers?.['.']||lp;
        const mismatch=['dependencies','devDependencies','optionalDependencies'].flatMap(k=>[...new Set([...Object.keys(p[k]||{}),...Object.keys(root[k]||{})])].filter(d=>p[k]?.[d]!==root[k]?.[d]?.specifier).map(d=>d));
        row(`${label}: manifest / lockfile`,'pnpm lockfile '+lp.lockfileVersion,manifests[i]?mismatch.length?`Declaration mismatch: ${mismatch.join(', ')}`:'Root specifiers match':'Manifest missing; cannot compare',mismatch.length?'error':'info',[manifests[i],lock]);
      } else row(`${label}: lockfile`,'Supported: npm v2/v3, pnpm v6/v9','Unsupported format/version; no consistency conclusion','warning',[lock]);
    }
    const declarations=g.filter(e=>e.kind==='instructions'||e.kind==='env');
    const required=new Set<string>();
    declarations.forEach(e=>{for(const m of e.content.matchAll(/(?:required(?: environment variables?| env)?\s*[:=]\s*|#\s*required\s+)([A-Z][A-Z0-9_]*(?:\s*,\s*[A-Z][A-Z0-9_]*)*)/gi))m[1].split(',').forEach(v=>required.add(v.trim()));});
    const envs=g.filter(e=>e.kind==='env');
    for(const key of required) {
      const present=envs.some(e=>e.content.split('\n').some(l=>new RegExp(`^\\s*${key}=`).test(l)&&!l.includes('[missing]')));
      row(`${label}: required variable ${key}`,'Explicitly declared required',present?'Present (value hidden)':'MISSING or no environment evidence',present?'info':'error',[...declarations,...envs]);
    }
  }
  for(const e of evidence) {
    for(const [pattern,check,detail] of [[/EADDRINUSE|address already in use/i,'Port in use','A process already occupies the requested port. Inspect the listener before stopping anything.'],[/Cannot find module|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/i,'Missing module','Runtime reports a missing module; inspect install state and import path.'],[/ERESOLVE|peer dependency|unmet peer/i,'Peer dependency conflict','Package manager reports a peer conflict; compare declared compatible versions.']] as const) if(pattern.test(e.content)) row(check,e.sourceLabel,detail,'error',[e]);
  }
  return results;
}
export function timeline(evidence:Evidence[]):TimelineEvent[] {
  const events:TimelineEvent[]=[];
  for(const e of evidence) {
    for(const h of e.entries) events.push({id:`${e.id}-${h.index}`,label:`${h.method} → HTTP ${h.status}`,detail:`${h.url} · ${h.duration} ms · ${h.responseDetails}${h.error?` · ${h.error}`:''}`,timestamp:h.startedDateTime||undefined,requestId:h.requestId,association:h.requestId?'explicit ID':'time/path inference',evidenceRefs:[{evidenceId:e.id,locator:`HAR entry ${h.index+1}`,entry:h.index}]});
    if(e.kind==='log') e.content.split('\n').forEach((line,i)=>{
      if(!line.trim()||events.length>600)return;
      let event:any;try{event=JSON.parse(line)}catch{event={message:line,timestamp:line.match(/\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d)/)?.[0],requestId:line.match(/(?:requestId|request-id)[=: ]+([\w-]+)/)?.[1]}}
      events.push({id:`${e.id}-L${i+1}`,label:String(event.event||event.message||'Log event').slice(0,150),detail:line.slice(0,2000),timestamp:event.timestamp||event.time,requestId:event.requestId||event.correlationId,association:event.requestId||event.correlationId?'explicit ID':'unlinked',evidenceRefs:[{evidenceId:e.id,locator:`line ${i+1}`,line:i+1}]});
    });
  }
  // Preserve per-source order. Different machines can have different clocks.
  return events;
}
