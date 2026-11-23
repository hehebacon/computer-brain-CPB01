/* CPB-01 deterministic cognitive kernel. No LLM, AI API, or network calls. */
import { analyzeText, analyzeFile, inputEngineStats, registerInputAdapter, INPUT_ENGINE_VERSION } from "./input-engine.js";
(() => {
 const STORAGE_KEY="cpb01-memory-v2",clean=s=>String(s).normalize("NFC").toLocaleLowerCase("vi").replace(/[!?.,;:]+$/g,"").trim();
 const memory={facts:[],turns:0,load(){try{const s=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");this.facts=Array.isArray(s.facts)?s.facts:[];this.turns=Number(s.turns)||0;}catch{this.facts=[];this.turns=0;}},save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({facts:this.facts,turns:this.turns}));}catch{}},add(subject,relation,object){const f={subject:subject.trim(),relation:relation.trim(),object:object.trim(),created:Date.now()},key=[clean(f.subject),clean(f.relation),clean(f.object)].join("|");if(!this.facts.some(x=>[clean(x.subject),clean(x.relation),clean(x.object)].join("|")===key))this.facts.push(f);this.save();return f;}};
 memory.load();let lastRepresentation=null;
 function answer(input){const raw=String(input??"").trim(),parsed=analyzeText(raw);lastRepresentation=parsed;memory.turns++;const q=clean(raw);
  if(!q)return "Bạn chưa nhập nội dung.";
  if(/^(xin chao|chao|hello|hi|hey)(\s|$)/.test(q))return "Chào bạn. Tôi là CPB-01. Input Engine đã phân tích đầu vào trước khi chuyển nội dung sang kernel.";
  if(/(ban la ai|may la ai|ten gi|gioi thieu)/.test(q))return "Tôi là CPB-01. Tôi có Universal Input Engine để nhận diện văn bản, cấu trúc và định dạng. Bộ suy luận hiện vẫn là nguyên mẫu ký hiệu, chưa phải trí tuệ tổng quát.";
  if(/^(ban co nho|nho gi|bo nho|memory)/.test(q)){if(!memory.facts.length)return "Bộ nhớ chưa có sự kiện. Dạy tôi bằng: Ghi nhớ: Trái Đất | là | hành tinh";return "Bộ nhớ có "+memory.facts.length+" sự kiện:\n"+memory.facts.map((f,i)=>(i+1)+". "+f.subject+" — "+f.relation+" — "+f.object).join("\n");}
  const teach=raw.match(/^(?:ghi nhớ|ghi nho|hãy nhớ|hay nho)\s*:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/i);
  if(teach){const f=memory.add(teach[1],teach[2],teach[3]);return "Đã lưu sự kiện:\n"+f.subject+" — "+f.relation+" — "+f.object+"\nViệc lưu không tự chứng minh dữ kiện đó đúng.";}
  const arithmetic=q.match(/^(?:tinh|calculate)\s+(-?\d+(?:\.\d+)?)\s*([+*/-])\s*(-?\d+(?:\.\d+)?)$/);
  if(arithmetic){const a=Number(arithmetic[1]),b=Number(arithmetic[3]),op=arithmetic[2];if(op==="/"&&b===0)return "Phép chia cho 0 không xác định.";return "Kết quả: "+(op==="+"?a+b:op==="-"?a-b:op==="*"?a*b:a/b);}
  const ask=raw.match(/^(.+?)\s+(?:là gì|la gi|là ai|la ai)\??$/i);
  if(ask){const subject=clean(raw.replace(/\s+(là gì|la gi|là ai|la ai)\??$/i,"")),found=memory.facts.filter(f=>clean(f.subject)===subject);if(found.length)return found.map(f=>f.subject+" "+f.relation+" "+f.object+".").join("\n");return "Tôi chưa có dữ kiện về “"+subject+"”. Tôi đã nhận diện đây là câu hỏi dạng truy vấn thực thể, nhưng chưa có tri thức để kết luận.";}
  if(/^(cam on|cảm ơn|thanks)/.test(q))return "Đã nhận. Lượt tương tác đã được xử lý.";
  return "Input Engine đã phân tích đầu vào:\n- Định dạng: "+parsed.format+"\n- Ngôn ngữ: "+parsed.language.label+"\n- Số từ ước tính: "+parsed.structure.words+"\n\nReasoning Kernel hiện chưa có quy tắc tri thức phù hợp để trả lời nội dung này. Tôi không tự bịa kết quả.";
 }
 window.CPB01={
  respond(text){const result=answer(text);memory.save();return {text:result,turns:memory.turns,facts:memory.facts.length,engine:"cpb01-cognitive-kernel",representation:lastRepresentation};},
  analyze(text){lastRepresentation=analyzeText(text);return lastRepresentation;},
  async processFile(file){const result=await analyzeFile(file);lastRepresentation=result;return result;},
  stats(){return {turns:memory.turns,facts:memory.facts.length,...inputEngineStats(),lastInputKind:lastRepresentation?lastRepresentation.kind:null};},
  lastInput(){return lastRepresentation;},registerAdapter:registerInputAdapter,
  clear(){memory.facts=[];memory.turns=0;memory.save();}
 };
 window.dispatchEvent(new CustomEvent("cpb01-ready",{detail:{inputEngineVersion:INPUT_ENGINE_VERSION}}));
})();
