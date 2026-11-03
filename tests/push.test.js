'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const crypto=require('node:crypto');
const {createPushHandler,validateSubscription}=require('../push-server');
const ec=crypto.createECDH('prime256v1');ec.generateKeys();
const sub={endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}};
const env={VAPID_PUBLIC_KEY:ec.getPublicKey().toString('base64url'),VAPID_PRIVATE_KEY:ec.getPrivateKey().toString('base64url'),PUSH_TOKEN_SECRET:'test-secret',PUBLIC_ORIGIN:'https://example.test'};
async function fixture(t,opts={}){
 const handler=createPushHandler({env,sender:async()=>({statusCode:201}),...opts});
 const server=http.createServer(async(req,res)=>{if(!await handler(req,res)){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const root='http://127.0.0.1:'+server.address().port;
 return async(path,{data,token,origin='https://example.test'}={})=>{
  const r=await fetch(root+'/api/push/'+path,{method:data===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
  return {status:r.status,data:await r.json()};
 };
}
test('rejects internal, lookalike and credential-bearing endpoints',()=>{
 assert.ok(validateSubscription(sub));
 for(const endpoint of ['https://127.0.0.1/a','https://fcm.googleapis.com.evil.test/a','http://fcm.googleapis.com/a','https://user@fcm.googleapis.com/a','https://fcm.googleapis.com:123/a'])assert.equal(validateSubscription({...sub,endpoint}),false);
});
test('unconfigured backend reports unavailable without leaking secrets',async t=>{
 const call=await fixture(t,{env:{PUBLIC_ORIGIN:"https://example.test"}});const r=await call('config');assert.equal(r.data.ready,false);assert.equal(r.data.publicKey,null);
 assert.equal((await call('test',{data:{}})).status,503);
});
test('rejects foreign origin and unsigned sends',async t=>{
 const call=await fixture(t);assert.equal((await call('subscribe',{data:sub,origin:'https://evil.test'})).status,403);
 assert.equal((await call('test',{data:{}})).status,401);
});
test('sends only to signed subscription, records acceptance and receipt',async t=>{
 let actual,payload;const call=await fixture(t,{sender:async(s,p)=>{actual=s;payload=JSON.parse(p);return {statusCode:201};}});
 const token=(await call('subscribe',{data:sub})).data.token;
 const result=await call('test',{token,data:{}});assert.equal(result.status,202);assert.equal(result.data.status,'accepted');assert.deepEqual(actual,sub);
 let status=await call('status/'+result.data.id,{token});assert.equal(status.data.providerStatus,201);
 await call('receipt',{data:{id:payload.receipt}});status=await call('status/'+result.data.id,{token});assert.equal(status.data.status,'received');
 assert.equal((await call('test',{token:token+'x',data:{}})).status,401);
});
test('delayed send waits for scheduler rather than client timer',async t=>{
 let scheduled,count=0;const call=await fixture(t,{schedule:(fn,ms)=>{assert.equal(ms,10000);scheduled=fn;},sender:async()=>{count++;return {statusCode:201};}});
 const token=(await call('subscribe',{data:sub})).data.token;
 const r=await call('test',{token,data:{delay:10}});assert.equal(r.data.status,'scheduled');assert.equal(count,0);await scheduled();assert.equal(count,1);
});
test('limits sends and reports expired subscription',async t=>{
 const call=await fixture(t,{sender:async()=>{throw {statusCode:410};}});const token=(await call('subscribe',{data:sub})).data.token;
 for(let i=0;i<3;i++)assert.equal((await call('test',{token,data:{}})).status,502);
 assert.equal((await call('test',{token,data:{}})).status,429);
});
test('another subscription cannot read a job',async t=>{
 const call=await fixture(t);const first=(await call('subscribe',{data:sub})).data.token;
 const second=(await call('subscribe',{data:{...sub,endpoint:sub.endpoint+'2'}})).data.token;
 const job=await call('test',{token:first,data:{}});assert.equal((await call('status/'+job.data.id,{token:second})).status,404);
});
test('SW displays push and opens the correct GitHub Pages path',async()=>{
 const vm=require('node:vm'),fs=require('node:fs');const handlers={};let shown,opened,receipt;
 const self={registration:{scope:'https://alexisyg1417.github.io/Medicore/',showNotification:async(t,o)=>shown={t,o}},location:{origin:'https://alexisyg1417.github.io',hostname:'alexisyg1417.github.io'},addEventListener:(n,f)=>handlers[n]=f,clients:{matchAll:async()=>[],openWindow:async u=>opened=u}};
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self,URL,console,fetch:async(u)=>{receipt=u;}});
 let pending;handlers.push({data:{json:()=>({title:'MediCore',body:'Aviso',receipt:'test'})},waitUntil:p=>pending=p});await pending;
 assert.equal(shown.t,'MediCore');assert.equal(receipt,'https://medicore-production-e034.up.railway.app/api/push/receipt');
 handlers.notificationclick({notification:{close(){}},waitUntil:p=>pending=p});await pending;assert.equal(opened,'https://alexisyg1417.github.io/Medicore/notificaciones.html');
});
