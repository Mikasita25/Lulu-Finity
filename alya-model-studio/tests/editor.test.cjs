const {JSDOM}=require('jsdom');const {createCanvas,Image}=require('@napi-rs/canvas');const fs=require('fs'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
const errors=[],downloads=[],canvases=new WeakMap();
const dom=new JSDOM(html.replace(/<script src=[^>]*><\/script>/g,''),{url:'https://studio.test/',runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
 for(const key of ['width','height']){const desc=Object.getOwnPropertyDescriptor(w.HTMLCanvasElement.prototype,key);Object.defineProperty(w.HTMLCanvasElement.prototype,key,{get:desc.get,set(v){desc.set.call(this,v);if(canvases.has(this))canvases.get(this)[key]=v}})}w.JSZip=require('../vendor/jszip.min.js');w.Image=Image;w.matchMedia=()=>({matches:false});w.ResizeObserver=class{observe(){}};w.confirm=()=>true;w.alert=x=>errors.push(String(x));w.URL.createObjectURL=x=>{downloads.push(x);return 'blob:test'};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
 w.HTMLCanvasElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,left:0,top:0,width:this.id==='viewport'?800:256,height:this.id==='viewport'?700:256}};
 w.HTMLCanvasElement.prototype.setPointerCapture=function(){};
 w.HTMLCanvasElement.prototype.getContext=function(type){if(type!=='2d')return null;let c=canvases.get(this);if(!c){c=createCanvas(this.width||300,this.height||150);canvases.set(this,c)}if(c.width!==this.width)c.width=this.width;if(c.height!==this.height)c.height=this.height;const ctx=c.getContext('2d');return new Proxy(ctx,{get(t,k){const v=t[k];if(typeof v!=='function')return v;return (...args)=>{if(k==='drawImage'&&args[0] instanceof w.HTMLCanvasElement){args[0].getContext('2d');args[0]=canvases.get(args[0])}return v.apply(t,args)}},set(t,k,v){t[k]=v;return true}})};
 w.HTMLCanvasElement.prototype.toDataURL=function(){this.getContext('2d');return canvases.get(this).toDataURL('image/png')};w.addEventListener('error',e=>errors.push(e.message));w.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 }});
const w=dom.window,d=w.document;const wait=()=>new Promise(r=>setTimeout(r,80));const $=s=>d.querySelector(s), click=s=>$(s).click();
async function blobText(b){return new Promise(r=>{const fr=new w.FileReader();fr.onload=()=>r(fr.result);fr.readAsText(b)})}
async function state(){click('#exportProject');return JSON.parse(await blobText(downloads.pop()))}
async function change(id,value){$(id).value=value;$(id).dispatchEvent(new w.Event('change',{bubbles:true}));await wait()}
(async()=>{
 await wait();assert.equal(errors.length,0,errors.join('\n'));assert.equal($('#cubeCount').textContent,'1 cubos');
 assert($('#workBridge').onclick);click('#workBridge');assert(!$('#workModal').classList.contains('hidden'));click('#closeWork');
 click('#addCube');assert.equal((await state()).cubes.length,2);click('#undo');assert.equal((await state()).cubes.length,1);click('#redo');assert.equal((await state()).cubes.length,2);
 await change('#pName','prueba');await change('#px','12');await change('#rx','25');let s=await state();assert.equal(s.cubes[1].name,'prueba');assert.equal(s.cubes[1].pos[0],12);assert.equal(s.cubes[1].rot[0],25);
 click('#duplicate');s=await state();assert.equal(s.cubes.length,3);assert.equal(s.cubes[2].pivot[0],s.cubes[1].pivot[0]+1);click('#delete');assert.equal((await state()).cubes.length,2);
 for(const b of d.querySelectorAll('[data-view]')){b.click();assert($('#viewBadge').textContent.length>0)}
 click('#textureMode');assert($('#tab-texture').classList.contains('active'));click('#newTexture');await wait();s=await state();assert.equal(s.textures.length,1);assert(s.cubes[1].textureId);
 await change('#uvU',8);await change('#uvV',5);await change('#uvW',12);await change('#uvH',10);await change('#uvRot',90);s=await state();assert.deepEqual(s.cubes[1].faceUV.north,[8,5,12,10]);assert.equal(s.cubes[1].faceRot.north,90);
 $('#paintColor').value='#84a736';const evt=(name,x,y)=>{const e=new w.Event(name);Object.assign(e,{clientX:x,clientY:y,pointerId:1});$('#textureCanvas').dispatchEvent(e)};evt('pointerdown',12,12);evt('pointerup',12,12);await wait();s=await state();let im=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=s.textures[0].data});const c=createCanvas(64,64);c.getContext('2d').drawImage(im,0,0);assert.deepEqual(Array.from(c.getContext('2d').getImageData(3,3,1,1).data),[132,167,54,255]);
 click('#saveProject');assert(w.localStorage.getItem('alya_model_project_v3'));
 click('#exportBB');const bb=JSON.parse(await blobText(downloads.pop()));assert.equal(bb.meta.model_format,'bedrock');assert.equal(bb.textures.length,1);assert.equal(bb.elements[1].faces.north.rotation,90);assert(bb.outliner[0].children.length===2);
 // Round-trip the downloaded bbmodel through the actual import handler.
 const f=new w.File([JSON.stringify(bb)],'test.bbmodel',{type:'application/json'});f.text=async()=>JSON.stringify(bb);Object.defineProperty($('#fileInput'),'files',{configurable:true,value:[f]});await $('#fileInput').onchange({target:$('#fileInput')});await wait();s=await state();assert.equal(s.textures[0].data,bb.textures[0].source);assert.deepEqual(s.cubes[1].faceUV.north,[8,5,12,10]);
 // Work JSON exercises deterministic model + texture edits without WebGL.
 $('#workPlan').value=JSON.stringify({project:'QA',replace:true,textures:[{name:'green.png',width:32,height:32,fill:'#408a30'}],cubes:[{name:'test',pos:[0,4,0],size:[8,8,8],texture:'green.png'}],paint:[{texture:'green.png',rect:[0,0,8,8],color:'#ffffff'}]});await $('#applyPlan').onclick();await wait();s=await state();assert.equal(s.cubes.length,1);assert.equal(s.textures.length,1);assert.equal(s.name,'QA');assert($('#workReport').textContent.includes('Plan aplicado'));
 // Failure leaves the previous project intact.
 $('#workPlan').value=JSON.stringify({replace:true,cubes:'invalid'});await $('#applyPlan').onclick();assert.equal((await state()).name,'QA');assert.equal((await state()).cubes.length,1);
 // Native Bedrock atlas export includes UV rotation baking and pixels.
 click('#exportGeo');await wait();await wait();assert(downloads.length>0);const geo=JSON.parse(await blobText(downloads.pop()));assert.equal(geo['minecraft:geometry'][0].description.texture_width,64);assert(geo['minecraft:geometry'][0].bones[0].cubes[0].uv.north.uv_size);
 click('#exportBedrock');await wait();await wait();assert.equal($('#downloadLink').download,'QA_bedrock.zip');assert(!$('#downloadModal').classList.contains('hidden'));const zipBlob=downloads.pop();const zipBytes=Buffer.from(await zipBlob.arrayBuffer());const zip=await w.JSZip.loadAsync(zipBytes);assert(zip.file('QA.geo.json'));assert(zip.file('QA_atlas.png'));assert((await zip.file('QA_atlas.png').async('uint8array')).length>100);click('#closeDownload');assert($('#downloadModal').classList.contains('hidden'));
 // Viewport contains rendered geometry, not only its dark background.
 const view=canvases.get($('#viewport'));const pix=view.getContext('2d').getImageData(400,350,1,1).data;assert(pix[1]>50,'No visible model at center');
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: initialization, cube edits, undo/redo, views, UV, paint, save, bbmodel round-trip, Work plans, rollback and Bedrock atlas export');w.close();
})().catch(e=>{console.error(e);console.error('UI errors:',errors);w.close();process.exitCode=1});
