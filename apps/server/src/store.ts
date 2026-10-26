import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Investigation, InvestigationDetail, Evidence, Analysis, Interaction, Mode} from '@stateghost/shared';
export class Store {
  db:DatabaseSync; dir:string;
  constructor(dir:string) {
    this.dir=path.resolve(dir);mkdirSync(this.dir,{recursive:true});mkdirSync(path.join(this.dir,'evidence'),{recursive:true});
    this.db=new DatabaseSync(path.join(this.dir,'stateghost.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS investigations(id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY, investigationId TEXT REFERENCES investigations(id) ON DELETE CASCADE, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS analyses(id TEXT PRIMARY KEY, investigationId TEXT REFERENCES investigations(id) ON DELETE CASCADE, revision INTEGER NOT NULL, data TEXT NOT NULL, UNIQUE(investigationId,revision));
      CREATE TABLE IF NOT EXISTS interactions(id TEXT PRIMARY KEY, investigationId TEXT REFERENCES investigations(id) ON DELETE CASCADE, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
  }
  list():Investigation[] {return (this.db.prepare('SELECT data FROM investigations').all() as any[]).map(r=>JSON.parse(r.data)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
  create(title:string,mode:Mode,sample=false) {const i:Investigation={id:randomUUID(),title,mode,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),sample};this.db.prepare('INSERT INTO investigations VALUES (?,?)').run(i.id,JSON.stringify(i));return this.get(i.id)!;}
  get(id:string):InvestigationDetail|undefined {
    const row=this.db.prepare('SELECT data FROM investigations WHERE id=?').get(id) as any;if(!row)return;
    const read=(table:string)=> (this.db.prepare(`SELECT data FROM ${table} WHERE investigationId=? ${table==='analyses'?'ORDER BY revision':''}`).all(id) as any[]).map(r=>JSON.parse(r.data));
    return {...JSON.parse(row.data),evidence:read('evidence'),analyses:read('analyses'),interactions:read('interactions')};
  }
  touch(id:string) {const i=this.get(id);if(!i)return;const {evidence,analyses,interactions,...base}=i;base.updatedAt=new Date().toISOString();this.db.prepare('UPDATE investigations SET data=? WHERE id=?').run(JSON.stringify(base),id);}
  addEvidence(e:Evidence) {this.db.prepare('INSERT INTO evidence VALUES (?,?,?)').run(e.id,e.investigationId,JSON.stringify(e));this.touch(e.investigationId);}
  updateEvidence(e:Evidence) {this.db.prepare('UPDATE evidence SET data=? WHERE id=?').run(JSON.stringify(e),e.id);this.touch(e.investigationId);}
  addAnalysis(id:string,a:Analysis) {this.db.prepare('INSERT INTO analyses VALUES (?,?,?,?)').run(a.id,id,a.revision,JSON.stringify(a));this.touch(id);}
  addInteraction(id:string,i:Interaction) {this.db.prepare('INSERT INTO interactions VALUES (?,?,?)').run(i.id,id,JSON.stringify(i));this.touch(id);}
  removeEvidence(id:string,eid:string) {this.db.prepare('DELETE FROM evidence WHERE id=? AND investigationId=?').run(eid,id);rmSync(path.join(this.dir,'evidence',eid),{force:true});this.touch(id);}
  delete(id:string) {const i=this.get(id);i?.evidence.forEach(e=>rmSync(path.join(this.dir,'evidence',e.id),{force:true}));this.db.prepare('DELETE FROM investigations WHERE id=?').run(id);}
  setting(key:string,value?:string):string|undefined {if(value!==undefined)this.db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(key,value);return (this.db.prepare('SELECT value FROM settings WHERE key=?').get(key) as any)?.value;}
  close(){this.db.close();}
}
