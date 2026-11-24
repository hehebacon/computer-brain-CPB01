/* CPB-01 Context Manager: bounded, explicit conversation context. */
const fold=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLocaleLowerCase("vi");
const STOP=new Set("la gi la cai gi la ai tai sao vi sao nhu the nao the nao lam sao con thi vay sao tui ban minh toi cua va voi cho trong mot nhung cac".split(" "));
const terms=s=>(fold(s).match(/[\p{L}\p{N}]+/gu)||[]).filter(x=>x.length>2&&!STOP.has(x));
export class ContextManager{
 constructor(data={}){this.maxTurns=12;this.turns=Array.isArray(data.turns)?data.turns.slice(-this.maxTurns):[];this.currentTopic=data.currentTopic||null;this.pendingQuestion=data.pendingQuestion||null;this.lastAnswer=data.lastAnswer||null;}
 inferTopic(text,memory){
  const q=terms(text);
  if(!q.length)return null;
  const ranked=(memory?.semantic||[]).map(f=>{
   const subject=terms(f.subject),object=terms(f.object);
   const score=q.filter(t=>subject.includes(t)).length*3+q.filter(t=>object.includes(t)).length;
   return {subject:f.subject,score};
  }).sort((a,b)=>b.score-a.score);
  if(ranked[0]?.score>0)return ranked[0].subject;
  const cleaned=String(text).replace(/[?？!！.。]+$/,"").trim();
  if(cleaned.length>1&&cleaned.length<80&&!/^(tai sao|vi sao|why|how|what|where|when|con|the con|vay con)\b/i.test(fold(cleaned)))return cleaned;
  return null;
 }
 observe({input,interpreted,result,memory}={}){
  const text=String(input||"");
  const topic=this.inferTopic(text,memory);
  if(topic)this.currentTopic=topic;
  if(result?.needsExternalEvidence)this.pendingQuestion={text:interpreted||text,topic:this.currentTopic,at:Date.now()};
  else if(result?.confidence>=0.45)this.pendingQuestion=null;
  this.lastAnswer=String(result?.text||"").slice(0,1200)||this.lastAnswer;
  this.turns.push({input:text.slice(0,500),interpreted:String(interpreted||text).slice(0,500),topic:this.currentTopic,at:Date.now()});
  this.turns=this.turns.slice(-this.maxTurns);
  return this.snapshot();
 }
 snapshot(){return {currentTopic:this.currentTopic,pendingQuestion:this.pendingQuestion?{...this.pendingQuestion}:null,turnCount:this.turns.length,recentTurns:this.turns.map(t=>({...t})),lastAnswer:this.lastAnswer};}
 export(){return this.snapshot();}
}
