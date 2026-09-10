'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {create}=require('./settings-persistence');
const design=require('./widget-design');

test('edits made during an earlier save survive and are persisted in order',async()=>{
 let current={volume:.3,widgets:{goal:{fontSize:22}}};let release;const writes=[];
 const save=create(async snapshot=>{writes.push(snapshot);if(writes.length===1)await new Promise(r=>release=r);return {...snapshot,normalized:true}},()=>current,value=>current=value);
 const first=save();await new Promise(r=>setImmediate(r));current.widgets={goal:{fontSize:35}};current.volume=.9;const second=save();release();await first;assert.equal(current.volume,.9);assert.equal(current.widgets.goal.fontSize,35);await second;assert.equal(writes[1].volume,.9);assert.equal(writes[1].widgets.goal.fontSize,35);assert.equal(current.normalized,true);
});
test('a failed save preserves edits and the next save can succeed',async()=>{let current={volume:.8};let attempts=0;const save=create(async s=>{if(++attempts===1)throw Error('disk');return s},()=>current,s=>current=s);await assert.rejects(save(),/disk/);assert.equal(current.volume,.8);await save();assert.equal(attempts,2)});
test('legacy settings keep defaults; extreme values and CSS injection are bounded',()=>{
 assert.equal(design.normalize().fontSize,22);assert.equal(design.normalize({scale:999,fontSize:-2}).scale,150);
 for(const source of ['file:///etc/passwd','javascript:alert(1)','/overlay-media/../../secret.png','https://example.com/a.png','/overlay-media/a.png");}body{color:red}'])assert.equal(design.image(source),'');
 const value=design.normalize({fontFamily:'serif;}body{display:none}',backgroundImage:'javascript:evil',shadow:Infinity,blur:-20});assert.equal(value.fontFamily,'system');assert.equal(value.shadow,24);assert.equal(value.blur,0);assert.equal(value.backgroundImage,'');
});
test('managed images and uploaded assets use the same visual properties',()=>{
 const image='/overlay-media/'+ 'a'.repeat(64)+'.png';const remote='https://example.com/v1/overlays/'+ 'b'.repeat(32)+'/assets/'+ 'a'.repeat(64)+'.png';
 assert.equal(design.image(image),image);assert.equal(design.image(remote),remote);const source={enabled:true,fontFamily:'rounded',fontSize:30,scale:90,borderWidth:4,backgroundImage:image,logoImage:image};const css=design.css(source);assert.ok(css.includes('font-size:30px'));assert.ok(css.includes('zoom:0.9'));assert.ok(css.includes('border-width:4px'));assert.ok(css.includes(image));assert.equal(design.css({...source,enabled:false}),'');
});
