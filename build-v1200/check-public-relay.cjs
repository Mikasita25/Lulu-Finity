'use strict';
const https=require('node:https');
const assert=require('node:assert/strict');
const host='lulu-finity-production-6b8f.up.railway.app';
function request(path,headers={}){
 return new Promise((resolve,reject)=>{
  const req=https.get({hostname:host,path,headers,timeout:20000},res=>{let body='';res.setEncoding('utf8');res.on('data',chunk=>{body+=chunk;if(body.length>65536)req.destroy(Error('Unexpected response size'));});res.on('end',()=>resolve({status:res.statusCode,body}));});
  req.on('timeout',()=>req.destroy(Error('Relay did not respond')));req.on('error',reject);
 });
}
(async()=>{
 const health=await request('/health');assert.equal(health.status,200);const data=JSON.parse(health.body);assert.equal(data.service,'lulu-finity-railway-relay');assert.equal(data.ok,true);assert.ok(data.keys.available>0,'No upstream keys available');
 // An empty username checks the public WebSocket route without opening an upstream LIVE or using quota.
 const probe=await request('/v1/tiktok/live',{'Connection':'Upgrade','Upgrade':'websocket','Sec-WebSocket-Version':'13','Sec-WebSocket-Key':'dGhlIHNhbXBsZSBub25jZQ=='});
 assert.equal(probe.status,400,'The deployed LIVE endpoint must accept public clients and then reject the empty username');
 console.log('Verified new relay: healthy, upstream available, public LIVE endpoint accepts credential-free clients.');
})().catch(error=>{console.error(error.message);process.exitCode=1});
