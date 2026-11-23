/* CPB-01 Cognitive Core v0.1
 * A bounded, inspectable cognitive cycle: perceive -> update working state ->
 * retrieve memory -> infer -> evaluate confidence -> formulate response.
 * This is an experimental symbolic architecture, not human-level cognition.
 */
const norm=s=>String(s??"").normalize("NFC").toLocaleLowerCase("vi").trim();
const words=s=>(String(s).match(/[\p{L}\p{M}\p{N}_]+/gu)||[]);
const now=()=>Date.now();

export class CognitiveMemory {
 constructor(){this.semantic=[];this.episodes=[];this.concepts=new Map();this.maxEpisodes=500;}
 learn(subject,relation,object,source="conversation",confidence=0.65){
  const triple={subject:String(subject).trim(),relation:String(relation).trim(),object:String(object).trim(),source,confidence,createdAt:now()};
  const key=[triple.subject,triple.relation,triple.object].map(norm).join("|");
  const old=this.semantic.find(x=>[x.subject,x.relation,x.object].map(norm).join("|")===key);
  if(old){old.confidence=Math.max(old.confidence,confidence);old.lastSeen=now();return old;}
  this.semantic.push(triple);for(const term of [subject,relation,object]){const k=norm(term);if(k)this.concepts.set(k,(this.concepts.get(k)||0)+1);}return triple;
 }
 rememberEpisode(episode){this.episodes.push({...episode,at:now()});if(this.episodes.length>this.maxEpisodes)this.episodes.shift();}
 recall(query,limit=8){const q=norm(query),terms=words(q);return this.semantic.map(f=>{const text=norm([f.subject,f.relation,f.object].join(" "));const score=terms.reduce((n,t)=>n+(text.includes(t)?1:0),0);return {fact:f,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,limit).map(x=>x.fact);}
 export(){return {semantic:this.semantic,episodes:this.episodes,concepts:[...this.concepts.entries()]};}
 import(data={}){this.semantic=Array.isArray(data.semantic)?data.semantic:[];this.episodes=Array.isArray(data.episodes)?data.episodes.slice(-this.maxEpisodes):[];this.concepts=new Map(Array.isArray(data.concepts)?data.concepts:[]);}
 clear(){this.semantic=[];this.episodes=[];this.concepts.clear();}
}
export class WorkingState {
 constructor(){this.turn=0;this.recent=[];this.focus=[];this.lastTopic=null;this.affect={valence:0,arousal:0,label:"neutral",confidence:0};}
 update(input,representation){
  this.turn++;const text=String(input);this.recent.push({role:"user",text,at:now(),format:representation?.format||"plain-text"});this.recent=this.recent.slice(-12);
  const lower=norm(text);
  const positive=/\b(cam on|cảm ơn|tuyệt|hay quá|vui|great|thanks|good)\b/.test(lower);
  const negative=/\b(bực|khó chịu|buồn|lo lắng|sợ|tệ|bad|angry|sad)\b/.test(lower);
  this.affect={valence:positive?0.5:negative?-0.5:0,arousal:/!{2,}|\?{2,}/.test(text)?0.6:0.2,label:positive?"positive-tone":negative?"negative-tone":"neutral",confidence:positive||negative?0.55:0.2};
  const found=words(text).filter(w=>w.length>2);this.focus=found.slice(-8);this.lastTopic=this.focus.at(-1)||this.lastTopic;
 }
}
function tokenizeMath(s){
 const out=[];let i=0;
 while(i<s.length){if(/\s/.test(s[i])){i++;continue;}const rest=s.slice(i);const num=rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);if(num){out.push({t:"n",v:Number(num[0])});i+=num[0].length;continue;}if("+-*/%^()".includes(s[i])){out.push({t:s[i],v:s[i]});i++;continue;}throw new Error("Ký tự không hợp lệ trong biểu thức: "+s[i]);}
 return out;
}
function calculate(expression){
 const ts=tokenizeMath(expression);let i=0;
 const peek=()=>ts[i]?.t;
 function atom(){const t=ts[i++];if(!t)throw Error("Thiếu toán hạng");if(t.t==="n")return t.v;if(t.t==="-")return -atom();if(t.t==="+")return atom();if(t.t==="("){const v=expr(0);if(peek()!==")")throw Error("Thiếu dấu )");i++;return v;}throw Error("Biểu thức không hợp lệ");}
 const bp={"+":1,"-":1,"*":2,"/":2,"%":2,"^":3};
 function expr(min){let left=atom();while(bp[peek()]!==undefined&&bp[peek()]>=min){const op=ts[i++].t,prec=bp[op],right=expr(prec+(op==="^"?0:1));if(op==="+")left+=right;else if(op==="-")left-=right;else if(op==="*")left*=right;else if(op==="/"){if(right===0)throw Error("Không thể chia cho 0");left/=right;}else if(op==="%"){if(right===0)throw Error("Không thể chia dư cho 0");left%=right;}else left=Math.pow(left,right);if(!Number.isFinite(left))throw Error("Kết quả vượt phạm vi số hữu hạn");}return left;}
 const value=expr(0);if(i!==ts.length)throw Error("Còn ký hiệu chưa xử lý");return value;
}
function extractTeach(text){
 let m=text.match(/^(?:ghi nhớ|ghi nho|hãy nhớ|hay nho)\s*:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/i);
 if(m)return {subject:m[1],relation:m[2],object:m[3]};
 m=text.match(/^(.+?)\s+(?:là|la)\s+(.+)$/i);
 if(m&&m[1].length<100&&m[2].length<180&&!/[?？]$/.test(text))return {subject:m[1],relation:"là",object:m[2]};
 return null;
}
function questionSubject(text){const m=text.match(/^(.+?)\s+(?:là gì|la gi|là ai|la ai)\??$/i);return m?m[1].trim():null;}
function infer(memory,subject){
 const direct=memory.semantic.filter(f=>norm(f.subject)===norm(subject));
 const derived=[];
 for(const a of direct.filter(f=>norm(f.relation)==="là"))for(const b of memory.semantic){if(norm(a.object)===norm(b.subject)&&norm(b.relation)==="thuộc nhóm")derived.push({subject:a.subject,relation:"có quan hệ suy ra là",object:b.object,source:"two-link-inference",confidence:Math.min(a.confidence,b.confidence)*0.8});}
 if(direct.length||derived.length){const facts=[...direct,...derived];return {facts,method:derived.length?"direct-recall+two-link-inference":"direct-recall",confidence:Math.max(...facts.map(f=>f.confidence))};}
 return {facts:[],method:"no-evidence",confidence:0};
}
export class CognitiveCore {
 constructor(memory=new CognitiveMemory()){this.memory=memory;this.state=new WorkingState();this.cycle=0;}
 process(input,representation){
  const raw=String(input??"").trim();this.cycle++;this.state.update(raw,representation);
  const trace=[{stage:"perception",result:"input represented",format:representation?.format||"plain-text"},{stage:"working-state",result:"context and affect estimate updated"}];
  if(!raw)return {text:"Tui chưa nhận được nội dung.",trace,confidence:0};
  const teach=extractTeach(raw);
  if(teach){const fact=this.memory.learn(teach.subject,teach.relation,teach.object,"user-stated",0.65);this.memory.rememberEpisode({type:"learning",summary:"A user supplied a fact",fact:{subject:fact.subject,relation:fact.relation,object:fact.object}});trace.push({stage:"memory-update",result:"stored user-stated fact"});return {text:"Tui đã lưu điều ông cung cấp: "+fact.subject+" "+fact.relation+" "+fact.object+". Đây là dữ kiện do người dùng cung cấp, chưa được xác minh độc lập.",trace,confidence:0.65};}
  const math=raw.match(/^(?:tính|tinh|calculate|what is)\s+(.+?)\s*[?？]?$/i);
  if(math){try{const result=calculate(math[1]);trace.push({stage:"reasoning",method:"arithmetic-expression-parser",result});return {text:"Kết quả: "+result,trace,confidence:1};}catch(e){return {text:"Tui chưa tính được biểu thức này: "+e.message,trace,confidence:0};}}
  const subject=questionSubject(raw);
  if(subject){const recalled=this.memory.recall(subject);const result=infer(this.memory,subject);trace.push({stage:"memory-retrieval",matches:recalled.length},{stage:"reasoning",method:result.method,confidence:result.confidence});if(result.facts.length)return {text:result.facts.map(f=>f.subject+" "+f.relation+" "+f.object+".").join("\n")+(result.method==="two-link-inference"?" (Đây là suy luận từ hai quan hệ đã lưu, chưa phải xác minh thực tế.)":""),trace,confidence:result.confidence};return {text:"Tui chưa có đủ dữ kiện để kết luận về “"+subject+"”. Nếu ông cung cấp thông tin liên quan, tui có thể lưu và thử suy ra từ các quan hệ đó.",trace,confidence:0};}
  const q=norm(raw);
  if(/^(xin chao|chao|hello|hi|hey)(\s|$)/.test(q))return {text:"Chào ông. Tui là CPB-01. Tui có thể trò chuyện cơ bản, ghi nhớ dữ kiện được cung cấp và giải biểu thức số học.",trace,confidence:0.9};
  if(/(ban la ai|may la ai|ten gi|gioi thieu)/.test(q))return {text:"Tui là CPB-01, một nguyên mẫu kiến trúc nhận thức có bộ nhớ, trạng thái làm việc và chu trình suy luận giới hạn. Tui chưa phải trí tuệ như con người.",trace,confidence:1};
  const recalled=this.memory.recall(raw);
  trace.push({stage:"memory-retrieval",matches:recalled.length},{stage:"reasoning",method:"evidence-association"});
  if(recalled.length)return {text:"Những dữ kiện liên quan tui tìm được:\n"+recalled.map(f=>"- "+f.subject+" "+f.relation+" "+f.object).join("\n")+"\nTui chưa đủ căn cứ để kết luận xa hơn.",trace,confidence:Math.min(0.7,recalled[0].confidence)};
  return {text:"Tui đã tiếp nhận nội dung và cập nhật trạng thái làm việc, nhưng chưa tìm được tri thức liên quan đủ mạnh để trả lời. Ông có thể nói rõ điều muốn tìm hiểu hoặc cung cấp dữ kiện để tui học.",trace,confidence:0.15};
 }
}
