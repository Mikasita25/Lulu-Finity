'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { normalizeColorRoulette, validateColorRoulette } = require('./color-roulette');
const ui = fs.readFileSync(path.join(__dirname, 'renderer.js'), 'utf8');
const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
const relay = fs.readFileSync(path.join(__dirname, '../railway-relay/src/overlay-page.js'), 'utf8');

test('los ocho colores conservan su probabilidad y admiten un archivo visual opcional', () => {
  const config = normalizeColorRoulette({ colors: [
    {index:0,probability:12.5,prize:'Premio 1',amount:25,media:{type:'gif',url:'https://example.com/rojo.gif',seconds:4}},
    ...Array.from({length:7}, (_,index)=>({index:index+1,probability:12.5}))
  ]});
  assert.equal(config.colors.length,8);
  assert.equal(config.colors[0].prize,'Premio 1');
  assert.equal(config.colors[0].amount,25);
  assert.equal(config.colors[0].media.type,'gif');
  assert.equal(config.colors[0].media.seconds,4);
  assert.equal(config.colors[1].media.type,'none');
  assert.equal(validateColorRoulette(config),'');
});

test('un enlace que no sea HTTPS no puede guardarse como acción',()=>{
  const bad=normalizeColorRoulette({colors:Array.from({length:8},(_,index)=>({index,probability:12.5,media:{type:'video',url:'file:///secret.mp4',seconds:100}}))});
  assert.match(validateColorRoulette(bad),/HTTPS/);
  assert.equal(bad.colors[0].media.seconds,30);
});

test('la app guarda acciones individualmente y transmite el recurso elegido con el resultado',()=>{
  assert.match(ui,/rouletteActionFields\(rows\)/);
  assert.match(ui,/readRouletteMedia\(panel,index\)/);
  assert.match(ui,/rouletteMediaError\(config\)/);
  const game=fs.readFileSync(path.join(__dirname,'live-games.js'),'utf8');
  assert.match(game,/rouletteMedia:selected\.media/);
  assert.match(game,/Math\.max\(cfg\.resultSeconds,selected\.media\.seconds\)/);
  assert.match(main,/scheduleRouletteMedia\(data\)/);
  assert.match(relay,/scheduleRouletteMedia\(data\)/);
  assert.match(relay,/media-src 'self' https:/);
});

test('el recurso aparece después del giro, sin repetirse al refrescar el overlay',()=>{
  const overlay=fs.readFileSync(path.join(__dirname,'main.js'),'utf8');
  const start=overlay.indexOf("let rouletteMediaKey = ''");
  const end=overlay.indexOf('\nlet rouletteFrame=null',start);
  assert.ok(start>=0 && end>start);
  const added=[],timers=new Map();
  let now=1000,id=0;
  const context={
    document:{body:{append(node){added.push(node)}},createElement(kind){
      return {tagName:kind.toUpperCase(),style:{},pause(){this.paused=true},remove(){this.removed=true},play(){this.played=true;return Promise.resolve()}};
    }},
    URL,Date:{now:()=>now},
    setTimeout(callback,delay){const n=++id;timers.set(n,{callback,delay});return n},
    clearTimeout(n){timers.delete(n)}
  };
  vm.createContext(context);
  vm.runInContext(overlay.slice(start,end),context);
  const payload={id:'color5',animationStartedAt:1000,animationDurationMs:14000,expiresAt:19000,rouletteMedia:{type:'video',url:'https://example.com/cinco.mp4',seconds:3}};
  context.scheduleRouletteMedia(payload);
  assert.equal(added.length,0);
  context.scheduleRouletteMedia(payload);
  assert.equal(timers.size,1);
  const trigger=[...timers.values()][0];now=15000;trigger.callback();
  assert.equal(added.length,1);
  assert.equal(added[0].tagName,'VIDEO');
  assert.equal(added[0].muted,true);
  assert.equal(added[0].src,'https://example.com/cinco.mp4');
  context.scheduleRouletteMedia(payload);
  assert.equal(added.length,1);
  context.stopRouletteMedia();
  assert.equal(added[0].removed,true);
});

test('la pantalla ignora acciones en sitios no HTTPS',()=>{
  const overlay=fs.readFileSync(path.join(__dirname,'main.js'),'utf8');
  const start=overlay.indexOf("let rouletteMediaKey = ''"),end=overlay.indexOf('\nlet rouletteFrame=null',start);
  const context={URL,Date,setTimeout,clearTimeout,document:{createElement(){throw new Error('No debe crear medios')}}};
  vm.createContext(context);
  vm.runInContext(overlay.slice(start,end),context);
  context.scheduleRouletteMedia({id:'bad',animationStartedAt:Date.now(),animationDurationMs:0,expiresAt:Date.now()+3000,rouletteMedia:{type:'gif',url:'javascript:alert(1)',seconds:3}});
});
