'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('events');
const { OverlayHub } = require('./overlay-hub-custom-assets');

class FakeRequest extends EventEmitter {
  constructor({ method='GET', headers={}, body='' }={}) { super(); this.method=method; this.headers=headers; this.body=Buffer.from(body); }
  flush(){ if(this.body.length)this.emit('data',this.body); this.emit('end'); }
}
class FakeResponse {
  constructor(){ this.statusCode=0; this.headers={}; this.chunks=[]; }
  writeHead(code,headers={}){ this.statusCode=code; this.headers=headers; }
  end(chunk=''){ if(chunk)this.chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(String(chunk))); }
  text(){ return Buffer.concat(this.chunks).toString('utf8'); }
}
async function publish(hub,body){
  const request=new FakeRequest({method:'POST',headers:{authorization:'Bearer secret'},body:JSON.stringify(body)});
  const response=new FakeResponse();
  const pending=hub.handleHttpRequest(request,response,new URL('http://localhost/v1/overlays/publish'));
  request.flush(); await pending; return response;
}

test('manifest and widget media survive through the stable source record', async()=>{
  const hub=new OverlayHub({clientTokens:new Set(['secret'])});
  const token='a'.repeat(32), name='image-123-test.png', bytes=Buffer.from('custom-widget-image');
  const published=await publish(hub,{token,source:'widget:goal',html:'<!doctype html>',state:{type:'goal'},media:{name,type:'image/png',base64:bytes.toString('base64')}});
  assert.equal(published.statusCode,200);

  const manifest=new FakeResponse();
  await hub.handleHttpRequest(new FakeRequest({headers:{authorization:'Bearer secret'}}),manifest,new URL(`http://localhost/v1/overlays/media-manifest?token=${token}&source=widget%3Agoal`));
  assert.equal(manifest.statusCode,200);
  assert.deepEqual(JSON.parse(manifest.text()).media,[name]);

  const media=new FakeResponse();
  await hub.handleHttpRequest(new FakeRequest(),media,new URL(`http://localhost/widget-media/${name}?type=goal&token=${token}`));
  assert.equal(media.statusCode,200);
  assert.deepEqual(Buffer.concat(media.chunks),bytes);
});

test('ranking custom media uses its own stable source namespace', async()=>{
  const hub=new OverlayHub({clientTokens:new Set(['secret'])});
  const token='b'.repeat(32), name='image-rank.webp', bytes=Buffer.from('rank-image');
  await publish(hub,{token,source:'ranking:3',state:{type:'ranking'},media:{name,type:'image/webp',base64:bytes.toString('base64')}});
  const media=new FakeResponse();
  await hub.handleHttpRequest(new FakeRequest(),media,new URL(`http://localhost/ranking-media/${name}?slot=3&token=${token}`));
  assert.equal(media.statusCode,200);
  assert.deepEqual(Buffer.concat(media.chunks),bytes);
});

test('media manifest requires the release client token', async()=>{
  const hub=new OverlayHub({clientTokens:new Set(['secret'])});
  const response=new FakeResponse();
  await hub.handleHttpRequest(new FakeRequest(),response,new URL(`http://localhost/v1/overlays/media-manifest?token=${'c'.repeat(32)}&source=widget%3Agoal`));
  assert.equal(response.statusCode,401);
});
