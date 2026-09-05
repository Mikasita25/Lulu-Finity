'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {EventEmitter}=require('node:events');
const WebSocket=require('ws');
const protocol=require('./relay-protocol');
const source=fs.readFileSync(path.join(__dirname,'main.js'),'utf8');

test('the desktop opens the public relay without requiring an embedded credential',async()=>{
 const body=source.slice(source.indexOf('async function createAndConnectLive('),source.indexOf('async function connectLive('));
 const seen=[];
 const context={EMBEDDED_RELAY_URL:'wss://lulu-finity-production-6b8f.up.railway.app/v1/tiktok/live',EMBEDDED_RELAY_CLIENT_TOKEN:'',liveConnection:null,liveConnectNonce:7,connectorModule:{},refreshAppSuspensionBlocker(){},attachLiveEvents(){},appendConnectionLog(){},send(){},withTimeout:p=>p,safeDisconnect:async()=>{},RailwayRelayConnection:class{constructor(...args){seen.push(args)}async connect(){return {roomId:'room-123'}}}};
 vm.createContext(context);vm.runInContext(body,context);
 const result=await context.createAndConnectLive('lulu_test',7,1);
 assert.equal(result.roomId,'room-123');assert.equal(seen[0][0],'lulu_test');assert.equal(seen[0][2],'');
});

test('the real WebSocket client receives LIVE events without an Authorization header',async()=>{
 const server=new WebSocket.Server({port:0,host:'127.0.0.1'});
 await new Promise(r=>server.once('listening',r));
 let request;
 server.on('connection',(socket,req)=>{request=req;socket.send(JSON.stringify({type:'room.status',data:{state:'connected',roomId:'verified-room'}}));socket.send(JSON.stringify({type:'WebcastChatMessage',data:{comment:'Hola Lulu',uniqueId:'viewer'}}));});
 const context={EventEmitter,WebSocket,URL,Buffer,...protocol,app:{getVersion:()=> '1.2.0'},cleanUsername:v=>String(v).replace(/^@/,''),normalizeRelayWebSocketUrl:v=>v,normalizeCloudMessageData:(_t,d)=>d,appendConnectionLog(){},send(){},cloudCloseMessage:(_code,reason)=>reason,setTimeout,clearTimeout};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('class RailwayRelayConnection'),source.indexOf('function friendlyConnectionError'))+'\nthis.Connection=RailwayRelayConnection;',context);
 const client=new context.Connection('lulu_test',`ws://127.0.0.1:${server.address().port}/v1/tiktok/live`,'',{});
 client.on('error',()=>{});
 const chat=new Promise(r=>client.once('chat',r));
 try{const result=await client.connect();assert.equal(result.roomId,'verified-room');assert.equal((await chat).comment,'Hola Lulu');assert.equal(request.headers.authorization,undefined);assert.equal(new URL(request.url,'http://localhost').searchParams.get('uniqueId'),'lulu_test');}finally{await client.disconnect();await new Promise(r=>server.close(r));}
});
