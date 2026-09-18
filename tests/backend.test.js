import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Bridge } from '../backend/bridge.js';
import { validate } from '../backend/protocol.js';
import { createServer } from '../backend/server.js';

test('validation rejects injection, unsupported fields, coercion and excessive work', () => {
  for (const payload of [{item:'../file',quantity:1},{item:'Base.Axe',quantity:26},{item:'Base.Axe',quantity:'2'},{item:'Base.Axe',quantity:1,code:'getPlayer()'}]) assert.throws(()=>validate('item',payload));
  assert.throws(()=>validate('stat',{stat:'__proto__',value:0}));
  assert.throws(()=>validate('xp',{perk:'Axe',amount:Infinity}));
  assert.throws(()=>validate('skill',{perk:'None',mode:'max'}));
  assert.throws(()=>validate('god',{enabled:'true',seconds:60}));
  assert.deepEqual(validate('item',{item:'Base.Axe',quantity:2}),{action:'item',item:'Base.Axe',quantity:2});
});
async function fixture(t, timeout=600) {
  const dir=await mkdtemp(join(tmpdir(),'motuca-test-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const bridge=new Bridge(dir,timeout);
  await writeFile(join(dir,'state.json'),JSON.stringify({protocol:1,at:Date.now(),session:'test-session',ready:true}));
  return {dir,bridge};
}
async function commandFile(dir) {
  for(let i=0;i<100;i++){try{return JSON.parse(await readFile(join(dir,'command.json'),'utf8'));}catch{await delay(10);}}
  throw new Error('Mailbox not written');
}
test('offline/stale/menu states cannot dispatch',async t=>{
  const {dir,bridge}=await fixture(t);
  for(const state of [{protocol:1,at:Date.now()-3000,session:'old',ready:true},{protocol:1,at:Date.now(),session:'menu',ready:false}]) {
    await writeFile(join(dir,'state.json'),JSON.stringify(state));
    await assert.rejects(bridge.send({action:'heal'}),e=>e.status===503);
  }
});
test('filesystem permission failure gives actionable error and releases the bridge',async t=>{
  const {bridge}=await fixture(t);
  bridge.status=async()=>{throw Object.assign(new Error('Access denied'),{code:'EPERM'});};
  await assert.rejects(bridge.send({action:'heal'}),e=>e.status===503 && e.message.includes('Sem permissão para gravar'));
  assert.equal(bridge.busy,false);
});
test('mailbox correlates confirmations, rejects concurrent calls and removes consumed commands',async t=>{
  const {dir,bridge}=await fixture(t);
  const pending=bridge.send({action:'item',item:'Base.Axe',quantity:2});
  await assert.rejects(bridge.send({action:'heal'}),e=>e.status===409);
  const command=await commandFile(dir);
  assert.equal(command.session,'test-session'); assert.ok(command.expires>Date.now());
  await writeFile(join(dir,'response.json'),JSON.stringify({id:'old',session:command.session,ok:true}));
  await delay(80); assert.equal(bridge.busy,true);
  await writeFile(join(dir,'response.json'),JSON.stringify({id:command.id,session:command.session,ok:true}));
  assert.equal((await pending).ok,true); assert.equal(bridge.busy,false);
  await assert.rejects(readFile(join(dir,'command.json')),{code:'ENOENT'});
});
test('game rejection and uncertain timeout are propagated without retries',async t=>{
  const {dir,bridge}=await fixture(t,400);
  const pending=bridge.send({action:'heal'});
  const rejection=assert.rejects(pending,e=>e.status===422 && e.message==='No player');
  const command=await commandFile(dir);
  await writeFile(join(dir,'response.json'),JSON.stringify({id:command.id,session:command.session,ok:false,error:'No player'}));
  await rejection;
  await assert.rejects(bridge.send({action:'heal'}),e=>e.status===504);
  assert.equal(bridge.busy,false);
});
test('trait list route serves the mod export and validation accepts its ids',async t=>{
  const {dir,bridge}=await fixture(t);
  const server=createServer(bridge);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await (await fetch(`${base}/api/traits/catalog`)).json(),{});
  await writeFile(join(dir,'traits.json'),JSON.stringify({NeedsMoreSleep:'Dorminhoco'}));
  assert.deepEqual(await (await fetch(`${base}/api/traits/catalog`)).json(),{NeedsMoreSleep:'Dorminhoco'});
  assert.deepEqual(validate('trait',{trait:'NeedsMoreSleep',enabled:false}),{action:'trait',trait:'NeedsMoreSleep',enabled:false});
  assert.throws(()=>validate('trait',{trait:'Needs More Sleep',enabled:false}));
});
test('HTTP requires local host, same origin, JSON and session token; serves dashboard',async t=>{
  const sent=[];
  const server=createServer({status:async()=>({connected:false,state:null}),send:async c=>{sent.push(c);return {ok:true};}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const config=await (await fetch(`${base}/api/session`)).json();
  assert.equal((await fetch(base)).status,200);
  assert.equal((await fetch(`${base}/api/session`,{headers:{Origin:'https://evil.example'}})).status,403);
  const hostileHost = await new Promise((resolve,reject)=>{http.get(`${base}/api/session`,{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});
  assert.equal(hostileHost,403);
  const post=(headers,body='{}')=>fetch(`${base}/api/player/heal`,{method:'POST',headers,body});
  assert.equal((await post({'Content-Type':'application/json'})).status,403);
  assert.equal((await post({'X-Trainer-Token':config.token,'Content-Type':'text/plain'})).status,415);
  const headers={'X-Trainer-Token':config.token,'Content-Type':'application/json'};
  assert.equal((await post(headers,'{bad')).status,400);
  assert.equal((await post(headers,'{"extra":true}')).status,400);
  assert.equal((await post(headers)).status,200);
  assert.deepEqual(sent,[{action:'heal'}]);
  assert.equal((await fetch(`${base}/../package.json`)).status,404);
});
