/* CPB-01 Cognitive Core v0.2
 * Explicit utterance classification, concept retrieval and provenance-aware answers.
 * A bounded symbolic prototype; not human-level cognition.
 */
import { HumanCognitiveSystems } from "./human-cognitive-systems.js";
const norm=s=>String(s??"").normalize("NFC").toLocaleLowerCase("vi").trim();
const fold=s=>norm(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");
const words=s=>(String(s).match(/[\p{L}\p{M}\p{N}_]+/gu)||[]);
const now=()=>Date.now();

export class CognitiveMemory {
 constructor(){this.semantic=[];this.episodes=[];this.concepts=new Map();this.maxEpisodes=500;}
 learn(subject,relation,object,source="conversation",confidence=0.65){
  const triple={subject:String(subject).trim(),relation:String(relation).trim(),object:String(object).trim(),source,confidence,createdAt:now()};
  const key=[triple.subject,triple.relation,triple.object].map(fold).join("|");
  const old=this.semantic.find(x=>[x.subject,x.relation,x.object].map(fold).join("|")===key);
  if(old){old.confidence=Math.max(old.confidence,confidence);old.lastSeen=now();return old;}
  this.semantic.push(triple);for(const term of [subject,relation,object]){const k=fold(term);if(k)this.concepts.set(k,(this.concepts.get(k)||0)+1);}return triple;
 }
 rememberEpisode(episode){this.episodes.push({...episode,at:now()});if(this.episodes.length>this.maxEpisodes)this.episodes.shift();}
 recall(query,limit=8){const terms=words(fold(query));return this.semantic.map(f=>{const text=fold([f.subject,f.relation,f.object].join(" "));const score=terms.reduce((n,t)=>n+(text.includes(t)?1:0),0);return {fact:f,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.fact);}
 export(){return {semantic:this.semantic,episodes:this.episodes,concepts:[...this.concepts.entries()]};}
 import(data={}){this.semantic=Array.isArray(data.semantic)?data.semantic:[];this.episodes=Array.isArray(data.episodes)?data.episodes.slice(-this.maxEpisodes):[];this.concepts=new Map(Array.isArray(data.concepts)?data.concepts:[]);}
 clear(){this.semantic=[];this.episodes=[];this.concepts.clear();}
}
export class WorkingState {
 constructor(){this.turn=0;this.recent=[];this.focus=[];this.lastTopic=null;this.affect={valence:0,arousal:0,label:"neutral",confidence:0};}
 update(input,representation){this.turn++;const text=String(input);this.recent.push({role:"user",text,at:now(),format:representation?.format||"plain-text"});this.recent=this.recent.slice(-12);const lower=fold(text);const positive=/(cam on|tuyet|hay qua|vui|great|thanks|good)/.test(lower);const negative=/(buc|kho chiu|buon|lo lang|so|te|bad|angry|sad)/.test(lower);this.affect={valence:positive?0.5:negative?-0.5:0,arousal:/!{2,}|\?{2,}/.test(text)?0.6:0.2,label:positive?"positive-tone":negative?"negative-tone":"neutral",confidence:positive||negative?0.55:0.2};this.focus=words(text).filter(w=>w.length>2).slice(-8);this.lastTopic=this.focus.at(-1)||this.lastTopic;}
}
function tokenizeMath(s){const out=[];let i=0;while(i<s.length){if(/\s/.test(s[i])){i++;continue;}const rest=s.slice(i);const num=rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);if(num){out.push({t:"n",v:Number(num[0])});i+=num[0].length;continue;}if("+-*/%^()".includes(s[i])){out.push({t:s[i],v:s[i]});i++;continue;}throw new Error("Ký tự không hợp lệ trong biểu thức: "+s[i]);}return out;}
function calculate(expression){const ts=tokenizeMath(expression);let i=0;const peek=()=>ts[i]?.t;function atom(){const t=ts[i++];if(!t)throw Error("Thiếu toán hạng");if(t.t==="n")return t.v;if(t.t==="-")return -atom();if(t.t==="+")return atom();if(t.t==="("){const v=expr(0);if(peek()!==")")throw Error("Thiếu dấu )");i++;return v;}throw Error("Biểu thức không hợp lệ");}const bp={"+":1,"-":1,"*":2,"/":2,"%":2,"^":3};function expr(min){let left=atom();while(bp[peek()]!==undefined&&bp[peek()]>=min){const op=ts[i++].t,prec=bp[op],right=expr(prec+(op==="^"?0:1));if(op==="+")left+=right;else if(op==="-")left-=right;else if(op==="*")left*=right;else if(op==="/"){if(right===0)throw Error("Không thể chia cho 0");left/=right;}else if(op==="%"){if(right===0)throw Error("Không thể chia dư cho 0");left%=right;}else left=Math.pow(left,right);if(!Number.isFinite(left))throw Error("Kết quả vượt phạm vi số hữu hạn");}return left;}const value=expr(0);if(i!==ts.length)throw Error("Còn ký hiệu chưa xử lý");return value;}

export function classifyUtterance(input){
 const text=String(input??"").trim(),q=fold(text);
 if(!text)return {intent:"empty",confidence:1};
 if(/^(ghi nho|hay nho)\s*:/.test(q))return {intent:"teach",confidence:0.99,explicit:true,teach:extractTeach(text)};
 const subject=questionSubject(text);
 if(subject)return {intent:"question-definition",subject,confidence:0.94};
 if(/^(tinh|calculate|what is)\s+/.test(q))return {intent:"calculation",confidence:0.95};
 if(/^(xin chao|chao|hello|hi|hey)(\s|$)/.test(q))return {intent:"greeting",confidence:0.95};
 if(/(ban la ai|may la ai|ten gi|gioi thieu)/.test(q))return {intent:"identity-question",confidence:0.9};
 const teach=extractTeach(text);
 if(teach)return {intent:"assertion",confidence:0.78,teach};
 if(/[?？]$/.test(text)||/^(tai sao|vi sao|how|why|where|when)\b/.test(q))return {intent:"question",confidence:0.7};
 return {intent:"statement-or-chat",confidence:0.55};
}
function extractTeach(text){
 const explicit=text.match(/^(?:ghi nhớ|ghi nho|hãy nhớ|hay nho)\s*:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/i);
 if(explicit)return {subject:explicit[1],relation:explicit[2],object:explicit[3]};
 const m=text.match(/^(.+?)\s+(?:là|la)\s+(.+)$/i);
 if(m&&m[1].length<100&&m[2].length<180&&!/[?？]$/.test(text)&&! /^(gì|gi|ai|sao|đâu|dau|nào|nao)\b/i.test(fold(m[2])))return {subject:m[1],relation:"là",object:m[2]};
 return null;
}
function questionSubject(text){const m=fold(text).match(/^(.+?)\s+(?:la gi|la ai|la cai gi|la con gi)\??$/i);return m?text.trim().replace(/[?？]+$/,"").replace(/\s+(?:là gì|la gi|là ai|la ai|là cái gì|la cai gi|là con gì|la con gi)\s*$/i,"").trim():null;}
function infer(memory,subject){const direct=memory.semantic.filter(f=>fold(f.subject)===fold(subject));const derived=[];for(const a of direct.filter(f=>fold(f.relation)==="la"))for(const b of memory.semantic){if(fold(a.object)===fold(b.subject)&&fold(b.relation)==="thuoc nhom")derived.push({subject:a.subject,relation:"có quan hệ suy ra là",object:b.object,source:"two-link-inference",confidence:Math.min(a.confidence,b.confidence)*0.8});}if(direct.length||derived.length){const facts=[...direct,...derived];return {facts,method:derived.length?"direct-recall+two-link-inference":"direct-recall",confidence:derived.length?Math.max(...derived.map(f=>f.confidence)):Math.max(...direct.map(f=>f.confidence))};}return {facts:[],method:"no-evidence",confidence:0};}

export class CognitiveCore {
 constructor(memory=new CognitiveMemory(),hcsData={}){
  this.memory=memory;this.state=new WorkingState();this.cycle=0;this.hcs=new HumanCognitiveSystems(hcsData);this.lastHCS=null;
  // Small, explicit baseline knowledge; provenance remains visible and distinct from user input.
  if(!this.memory.semantic.some(f=>fold(f.subject)==="trai dat"&&f.source==="builtin-knowledge")){
   this.memory.learn("Trái Đất","là","hành tinh","builtin-knowledge",0.99);
   this.memory.learn("Trái Đất","quay quanh","Mặt Trời","builtin-knowledge",0.99);
   this.memory.learn("Trái Đất","thuộc","Hệ Mặt Trời","builtin-knowledge",0.99);
  }
 }
 process(input,representation){
  const raw=String(input??"").trim();this.cycle++;this.state.update(raw,representation);
  const trace=[{stage:"perception",result:"input represented",format:representation?.format||"plain-text"}];
  this.lastHCS=this.hcs.process(raw);
  trace.push({stage:"human-cognitive-systems",emotion:this.lastHCS.emotion.primary,questionType:this.lastHCS.question.type,dialogueAct:this.lastHCS.dialogueAct,familiarity:this.lastHCS.familiarity.level});
  if(!raw)return {text:"Tui chưa nhận được nội dung.",trace,confidence:0};
  const intent=classifyUtterance(raw);trace.push({stage:"intent-classification",intent:intent.intent,confidence:intent.confidence});
  if(intent.intent==="teach"||intent.intent==="assertion"){
   const fact=this.memory.learn(intent.teach.subject,intent.teach.relation,intent.teach.object,"user-stated",0.65);
   this.memory.rememberEpisode({type:"learning",summary:"A user supplied a fact",fact:{subject:fact.subject,relation:fact.relation,object:fact.object}});
   trace.push({stage:"memory-update",result:"stored user-stated fact"});
   return {text:"Tui đã lưu dữ kiện ông cung cấp: "+fact.subject+" "+fact.relation+" "+fact.object+". Nguồn: người dùng cung cấp; chưa xác minh độc lập.",trace,confidence:0.65};
  }
  if(intent.intent==="calculation"){const math=raw.replace(/^(tính|tinh|calculate|what is)\s+/i,"").replace(/[?？]+$/,"");try{const result=calculate(math);trace.push({stage:"reasoning",method:"arithmetic-expression-parser",result});return {text:"Kết quả: "+result,trace,confidence:1};}catch(e){return {text:"Tui chưa tính được biểu thức này: "+e.message,trace,confidence:0};}}
  if(intent.intent==="question-definition"){
   const result=infer(this.memory,intent.subject);const facts=result.facts;
   trace.push({stage:"memory-retrieval",matches:facts.length},{stage:"reasoning",method:result.method,confidence:result.confidence});
   if(facts.length){const lines=facts.map(f=>f.subject+" "+f.relation+" "+f.object+".");const sources=[...new Set(facts.map(f=>f.source))];const note=sources.includes("user-stated")?" Có dữ kiện do người dùng cung cấp, chưa được xác minh.":sources.includes("builtin-knowledge")?" Dựa trên tri thức nền được đóng gói trong nguyên mẫu.":"";return {text:lines.join("\n")+note+(result.method.includes("two-link-inference")?" Đây là suy luận từ hai quan hệ đã lưu, chưa phải xác minh thực tế.":""),trace,confidence:result.confidence};}
   return {text:"Tui chưa có đủ dữ kiện để định nghĩa “"+intent.subject+"”. Tui sẽ không tự bịa câu trả lời.",trace,confidence:0};
  }
  if(intent.intent==="greeting")return {text:"Chào ông. Tui đang nghe đây. Ông muốn tìm hiểu hay thử suy luận điều gì?",trace,confidence:0.9};
  if(intent.intent==="identity-question")return {text:"Tui là CPB-01, một nguyên mẫu có bộ nhớ khái niệm, nhận diện ý định, truy xuất quan hệ và suy luận biểu tượng còn giới hạn.",trace,confidence:1};
  const recalled=this.memory.recall(raw);
  trace.push({stage:"memory-retrieval",matches:recalled.length},{stage:"reasoning",method:"evidence-association"});
  if(recalled.length)return {text:"Tui tìm thấy các dữ kiện có liên quan:\n"+recalled.map(f=>"- "+f.subject+" "+f.relation+" "+f.object+" [nguồn: "+f.source+"]").join("\n")+"\nTui chưa đủ căn cứ để kết luận xa hơn.",trace,confidence:Math.min(0.7,recalled[0].confidence)};
  return {text:intent.intent==="question"?"Tui nhận ra đây là câu hỏi, nhưng hiện chưa có tri thức phù hợp để trả lời.":"Tui chưa hiểu rõ ý ông. Ông thử diễn đạt thành câu hỏi cụ thể hoặc dạy tui một quan hệ theo dạng: Ghi nhớ: chủ thể | quan hệ | đối tượng.",trace,confidence:0.15};
 }
}
