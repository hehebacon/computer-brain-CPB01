/* CPB-01 Context Manager: bounded, explicit conversation context. */
const fold=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLocaleLowerCase("vi");
const STOP=new Set("la gi la cai gi la ai tai sao vi sao nhu the nao the nao lam sao bao nhieu o dau khi nao co the ban tui minh toi cua va voi cho trong mot nhung cac".split(" "));
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
  const topicCandidate=cleaned.replace(/^(?:tai sao|vi sao|why(?:\s+do)?|how(?:\s+does)?|what(?:\s+is|\s+are)?|where(?:\s+is)?|when(?:\s+is)?)\s+/i,"").replace(/^(?:cac|the|a|an)\s+/i,"").trim();
  if(topicCandidate.length>1&&topicCandidate.length<80&&!/^(con|the con|vay con)\b/i.test(fold(topicCandidate)))return topicCandidate;
  return null;
 }
 observe({input,interpreted,result,memory,preserveTopic=false}={}){
  const text=String(input||"");
  const topic=preserveTopic?null:this.inferTopic(text,memory);
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
