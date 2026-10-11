'use strict';
const types=['playlist','wallet','game','alert','goal','gift'];
function normalize(source={}){return {autoHide:source.autoHide!==false,displaySeconds:Math.max(1,Math.min(300,Number(source.displaySeconds)||10))};}
function signature(payload){const {updatedAt,activityAt,activityExpiresAt,activitySignature,autoHide,...content}=payload;if(['playlist','goal','gift','ranking'].includes(content.type))delete content.id;return JSON.stringify(content);}
function stamp(payload,previous,config={},now=Date.now()){
 const options=normalize(config),same=previous&&signature(payload)===previous.activitySignature;
 const activityAt=same?previous.activityAt:now;
 const end=payload.animationDurationMs?Number(payload.expiresAt):activityAt+options.displaySeconds*1000;
 return {...payload,autoHide:options.autoHide,activityAt,activityExpiresAt:end,activitySignature:signature(payload)};
}
module.exports={normalize,stamp,signature,types};
