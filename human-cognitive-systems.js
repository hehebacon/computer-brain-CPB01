/* CPB-01 Human Cognitive Systems (HCS) v0.1
 * Observable, bounded models for dialogue and social signals.
 * Emotion and familiarity are estimates, not claims about inner experience or relationships.
 */
const norm=s=>String(s??"").normalize("NFC").toLocaleLowerCase("vi").trim();
const fold=s=>norm(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");
const words=s=>String(s).match(/[\p{L}\p{M}\p{N}_]+/gu)||[];
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));

const EMOTION_LEXICON={
 joy:["vui","hanh phuc","phan khoi","tuyet voi","qua da","thich qua","yeu doi","great","happy","glad","excited","haha","hehe"],
 sadness:["buon","that vong","chan nan","co don","met moi","that bai","sad","upset","disappointed","lonely"],
 anger:["tuc","gian","buc xuc","kho chiu","uc che","phien","annoyed","angry","furious"],
 fear:["so","lo lang","hoang so","bat an","run","fear","afraid","worried","anxious"],
 surprise:["bat ngo","khong ngo","kinh ngac","wow","surprised","unexpected"],
 confusion:["khong hieu","roi qua","boi roi","kho hieu","confused","unclear","what do you mean"],
 gratitude:["cam on","biet on","thanks","thank you","appreciate"],
 curiosity:["to mo","muon biet","tai sao","vi sao","how does","wonder"]
};
export function recognizeEmotion(input){
 const text=fold(input), hits=[];
 for(const [emotion,terms] of Object.entries(EMOTION_LEXICON)){
  const matched=terms.filter(term=>text.includes(fold(term)));
  if(matched.length)hits.push({emotion,signals:matched,count:matched.length});
 }
 const punctuation=(String(input).match(/[!?]{2,}/g)||[]).length;
 const intensity=clamp(0.25+Math.min(0.45,hits.reduce((n,h)=>n+h.count,0)*0.12)+Math.min(0.3,punctuation*0.1));
 hits.sort((a,b)=>b.count-a.count);
 return {primary:hits[0]?.emotion||"undetermined",signals:hits, intensity:hits.length?intensity:0,confidence:hits.length?clamp(0.42+hits[0].count*0.13,0,0.82):0.15,method:"lexicon-and-punctuation-heuristic",caveat:"Ước lượng từ văn bản; không xác định chắc chắn cảm xúc thật của người viết."};
}
export function classifyQuestion(input){
 const text=String(input??"").trim(),q=fold(text);
 const def=q.match(/^(.+?)\\s+(?:la gi|la ai|la cai gi|la con gi)\\??$/);
 if(!/[?？]$/.test(text)&&!def&&! /^(ai|gi|cai gi|tai sao|vi sao|o dau|khi nao|the nao|lam sao|bao nhieu|co phai|is|are|what|who|why|where|when|how)\\b/.test(q))return {isQuestion:false,type:"none",target:null,confidence:0.2};
 let type="general",target=null;
 if(def){type="definition";target:text.replace(/\\s+(?:là gì|la gi|là ai|la ai|là cái gì|la cai gi|là con gì|la con gi)\\s*\\??$/i,"").trim();}
 else if(/^(ai|who)\\b/.test(q))type="person";
 else if(/^(gi|cai gi|what)\\b/.test(q))type="definition-or-object";
 else if(/^(tai sao|vi sao|why)\\b/.test(q))type="cause";
 else if(/^(o dau|where)\\b/.test(q))type="location";
 else if(/^(khi nao|when)\\b/.test(q))type="time";
 else if(/^(the nao|lam sao|how)\\b/.test(q))type="method-or-process";
 else if(/^(bao nhieu|how many|how much)\\b/.test(q))type="quantity";
 else if(/^(co phai|is|are|do|does|did|can|will)\\b/.test(q))type="yes-no";
 return {isQuestion:true,type,target,confidence:def?0.94:0.72};
}
export function classifyDialogueAct(input){
 const q=fold(input);
 if(/^(xin chao|chao|hello|hi|hey)(\s|!|$)/.test(q))return "greeting";
 if(/^(cam on|thanks|thank you)/.test(q))return "thanks";
 if(/^(xin loi|sorry|my bad)/.test(q))return "apology";
 if(/^(hay|lam on|vui long|please|giup tui|giup toi)/.test(q))return "request";
 if(/^(khong dong y|toi khong dong y|sai roi|i disagree)/.test(q))return "disagreement";
 if(/[?？]$/.test(String(input).trim()))return "question";
 return "statement";
}
export class FamiliarityModel{
 constructor(data={}){this.turns=Number(data.turns)||0;this.firstSeen=data.firstSeen||null;this.lastSeen=data.lastSeen||null;this.styleCounts=data.styleCounts||{};}
 observe(input,at=Date.now()){
  this.turns++;this.firstSeen=this.firstSeen||at;this.lastSeen=at;
  const q=String(input);
  const style=/\b(tui|toi|mình|minh)\b/i.test(q)?"casual-first-person":/\b(quý|kính|please|sir|madam)\b/i.test(q)?"formal":"unmarked";
  this.styleCounts[style]=(this.styleCounts[style]||0)+1;
  return this.snapshot(at);
 }
 snapshot(at=Date.now()){
  const level=this.turns<3?"new":this.turns<12?"occasional":this.turns<40?"familiar":"frequent";
  return {level,interactionCount:this.turns,daysSinceFirst:this.firstSeen?Math.max(0,Math.floor((at-this.firstSeen)/86400000)):0,communicationStyle:Object.entries(this.styleCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||"unknown",meaning:"Chỉ mô tả lịch sử tương tác trong bộ nhớ cục bộ; không phải mức độ tình cảm hay quan hệ cá nhân."};
 }
 export(){return {turns:this.turns,firstSeen:this.firstSeen,lastSeen:this.lastSeen,styleCounts:this.styleCounts};}
}
export class HumanCognitiveSystems{
 constructor(data={}){this.familiarity=new FamiliarityModel(data.familiarity);}
 process(input){
  const emotion=recognizeEmotion(input),question=classifyQuestion(input),dialogueAct=classifyDialogueAct(input),familiarity=this.familiarity.observe(input);
  const attention=words(input).filter(w=>w.length>3).slice(-8);
  return {emotion,question,dialogueAct,familiarity,attention,selfMonitoring:{uncertainty:Math.max(0,1-Math.max(emotion.confidence,question.confidence)),needsClarification:question.isQuestion&&question.confidence<0.55}};
 }
 export(){return {familiarity:this.familiarity.export()};}
}
