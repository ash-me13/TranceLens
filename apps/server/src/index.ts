import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import {existsSync} from 'node:fs';
import {createApp} from './app.js';
import {Store} from './store.js';
import {testProvider} from './test-provider.js';
const root=path.resolve(import.meta.dirname,'../../..');
// npm workspace scripts use a workspace cwd; normalize .env and data paths to the repository.
const {config}=await import('dotenv');config({path:path.join(root,'.env')});
const testMode=process.env.TRACELENS_TEST_PROVIDER==='1'||process.env.STATEGHOST_TEST_PROVIDER==='1';
if(testMode&&process.env.NODE_ENV!=='test')throw new Error('Test provider requires NODE_ENV=test. It cannot be an inference fallback.');
const store=new Store(path.resolve(root,process.env.DATA_DIR||'data'));
const app=createApp(store,testMode?testProvider:undefined);
const web=path.join(root,'apps/web/dist');if(existsSync(web)){app.use(express.static(web));app.get('*',(_req,res)=>res.sendFile(path.join(web,'index.html')));}
const server=app.listen(Number(process.env.PORT||3001),process.env.HOST||'127.0.0.1',()=>console.log(`TraceLens API: http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||3001}${testMode?' [AUTOMATED TEST PROVIDER]':''}`));
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>server.close(()=>{store.close();process.exit(0);}));
