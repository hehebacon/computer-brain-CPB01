/* CPB-01 Universal Representation (UIR)
 * A loss-aware, versioned intermediate representation. It describes input;
 * it does not claim semantic understanding that has not been performed.
 */
let sequence=0;
const UIR_SCHEMA="cpb01.uir/1.0";
const wordPattern=/[\p{L}\p{M}\p{N}_]+/gu;
function makeId(){sequence++;return "uir-"+Date.now().toString(36)+"-"+sequence.toString(36);}
function spans(text,regex,kind){const out=[];regex.lastIndex=0;let m;while((m=regex.exec(text))!==null){out.push({kind,text:m[0],start:m.index,end:m.index+m[0].length});if(!m[0].length)regex.lastIndex++;}return out;}
function textSegments(text){
 const out=[];
 const paragraphRe=/\S[\s\S]*?(?=\n\s*\n|$)/g;
 for(const p of spans(text,paragraphRe,"paragraph")){
  out.push({...p,children:spans(p.text,/[.!?。！？]+(?:\s+|$)|[^.!?。！？]+$/gu,"sentence").map(s=>({kind:"sentence",text:s.text,start:p.start+s.start,end:p.start+s.end}))});
 }
 return out;
}
function base(source,modality,format,status){
 return {schema:UIR_SCHEMA,id:makeId(),createdAt:new Date().toISOString(),kind:modality==="text"?"text":"file",modality,format,status,
  source:{name:source.name||null,mimeType:source.mimeType||null,extension:source.extension||null,sizeBytes:Number.isFinite(source.sizeBytes)?source.sizeBytes:null,encoding:source.encoding||null,lastModified:Number.isFinite(source.lastModified)?source.lastModified:null},
  content:{raw:null,normalized:null,normalization:{applied:[],lossy:false}},
  language:{label:"undetermined",confidence:0,method:"not-run"},scripts:[],segments:[],tokens:[],
  structure:{type:"unknown",attributes:{}},interpretation:{status:"not-performed",claims:[],entities:[],relations:[],uncertainties:[]},
  provenance:{stages:[],parentIds:[],transformations:[]},limitations:[],diagnostics:[]};
}
export function buildTextRepresentation(text,meta={}){
 const raw=String(text??""),normalized=raw.replace(/\r\n?/g,"\n").normalize("NFC");
 const u=base({name:meta.name,mimeType:meta.mimeType,extension:meta.extension,sizeBytes:meta.sizeBytes??new TextEncoder().encode(raw).length,encoding:meta.encoding||"unicode-string",lastModified:meta.lastModified},"text",meta.format||"plain-text",meta.status||"analyzed");
 u.content={raw,normalized,normalization:{applied:[...(raw!==normalized?["line-ending-or-NFC"]:[])],lossy:false}};
 u.language=meta.language||u.language;u.scripts=meta.scripts||[];
 u.segments=textSegments(normalized);u.tokens=spans(normalized,wordPattern,"word");
 const attributes=meta.structure||{characters:normalized.length,words:u.tokens.length,lines:normalized.split("\n").length};\n u.structure={type:meta.structureType||"text",attributes,...attributes};
 u.interpretation={status:meta.interpretationStatus||"not-performed",claims:[],entities:[],relations:[],uncertainties:meta.uncertainties||[]};
 u.provenance.stages=[{name:"decode",status:"complete",method:meta.encoding||"unicode-string"},{name:"normalize",status:"complete",method:"CRLF-to-LF + NFC; raw text retained"},{name:"format-detection",status:"complete",method:meta.detectionMethod||"extension/content heuristic"},{name:"structure-analysis",status:"complete",method:meta.format||"plain-text"}];
 u.provenance.transformations=u.content.normalization.applied;
 u.diagnostics=meta.diagnostics||[];
 u.limitations=meta.limitations||[];
 return u;
}
export function buildBinaryRepresentation(meta={}){
 const u=base(meta.source||{},meta.modality||"binary",meta.format||"unknown",meta.status||"recognized-needs-adapter");
 u.kind="file";u.content={raw:null,normalized:null,normalization:{applied:[],lossy:false}};
 const attributes=meta.structure||{};\n u.structure={type:meta.structureType||"binary",attributes,...attributes};
 u.provenance.stages=[{name:"signature-detection",status:"complete",method:meta.detectionMethod||"magic-bytes/extension"},{name:"content-extraction",status:"not-available",method:"adapter-required"}];
 u.interpretation={status:"not-performed",claims:[],entities:[],relations:[],uncertainties:["Binary content has not been extracted; no semantic claims are made."]};
 u.limitations=meta.limitations||["No content decoder is installed for this format."];
 u.diagnostics=meta.diagnostics||[];
 return u;
}
export function validateRepresentation(u){
 const errors=[];
 if(!u||typeof u!=="object")return {valid:false,errors:["Representation must be an object."]};
 if(u.schema!==UIR_SCHEMA)errors.push("Unsupported schema version.");
 for(const key of ["id","kind","modality","format","status","source","content","segments","tokens","structure","interpretation","provenance"])if(!(key in u))errors.push("Missing required field: "+key);
 if(u.content&&u.content.raw!==null&&typeof u.content.raw!=="string")errors.push("content.raw must be a string or null.");
 if(u.content&&u.content.normalized!==null&&typeof u.content.normalized!=="string")errors.push("content.normalized must be a string or null.");
 if(!Array.isArray(u.segments)||!Array.isArray(u.tokens))errors.push("segments and tokens must be arrays.");
 for(const token of u.tokens||[])if(!Number.isInteger(token.start)||!Number.isInteger(token.end)||token.start<0||token.end<token.start)errors.push("Invalid token span.");
 return {valid:errors.length===0,errors};
}
export const UIR_VERSION=UIR_SCHEMA;
