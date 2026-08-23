'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MAX_RELAY_FRAME_BYTES, parseRelayFrame, sanitizeRelayMessage } = require('./relay-protocol');

test('un comentario conserva únicamente lo necesario para una solicitud musical', () => {
  const [message] = parseRelayFrame(JSON.stringify({ type:'WebcastChatMessage', data:{
    comment:'!cancion Numb', cookie:'secreto', path:'C:\\privado',
    user:{ uniqueId:'fan', nickname:'Lulu Fan', token:'secreto', email:'privado@example.com', profilePicture:{urlList:['https://p16.example/avatar.jpg','file:///etc/passwd']} }
  }}));
  assert.equal(message.data.comment,'!cancion Numb');
  assert.equal(message.data.user.uniqueId,'fan');
  assert.deepEqual(message.data.user.profilePicture.urlList,['https://p16.example/avatar.jpg']);
  assert.equal('cookie' in message.data,false);
  assert.equal('token' in message.data.user,false);
});

test('eventos no musicales se vacían antes de entrar a la app', () => {
  for (const type of ['WebcastGiftMessage','WebcastLikeMessage','WebcastSocialMessage','WebcastMemberMessage','roomInfo']) {
    assert.deepEqual(sanitizeRelayMessage({type,data:{private:'descartar'}}),{type:'lulu.ignored',data:{}});
  }
});

test('rechaza operaciones remotas y tipos desconocidos', () => {
  for (const type of ['rpc.read-files','ipc.invoke','get.cookies','session.export','device_upload']) {
    assert.throws(()=>sanitizeRelayMessage({type,data:{}}),(error)=>error?.code==='forbidden_remote_request');
  }
  assert.throws(()=>sanitizeRelayMessage({type:'MadeUpEvent',data:{}}),(error)=>error?.code==='unsupported_type');
  assert.throws(()=>sanitizeRelayMessage({type:'WebcastChatMessage',data:'texto'}),(error)=>error?.code==='invalid_data');
});

test('limita el tamaño y cantidad de mensajes', () => {
  assert.throws(()=>parseRelayFrame('x'.repeat(MAX_RELAY_FRAME_BYTES+1)),(error)=>error?.code==='frame_size');
  assert.throws(()=>parseRelayFrame(JSON.stringify(Array.from({length:129},()=>({type:'tiktok.connect',data:{}})))),(error)=>error?.code==='batch_size');
});
