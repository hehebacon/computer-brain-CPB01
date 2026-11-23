/* CPB-01 bounded symbolic reasoning engine.
 * Three-valued conditions: true, explicitly false, or unknown.
 * Forward chaining is bounded; every derived fact records its rule and premises.
 */
const norm=value=>String(value??"").normalize("NFC").toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").trim();
const key=f=>[f.subject,f.relation,f.object].map(norm).join("|");
const CATEGORY_RELATIONS=new Set(["la","is-a","thuoc nhom","belongs-to","thuoc"]);
const clamp01=n=>Math.max(0,Math.min(1,Number(n)||0));
const factMatches=(pattern,fact)=>["subject","relation","object"].every(k=>pattern[k]==="*"||pattern[k]===undefined||norm(pattern[k])===norm(fact[k]));
export class ReasoningEngine{
 constructor({maxDepth=4,maxFacts=500,rules=[]}={}){
  this.maxDepth=Math.max(1,Math.min(8,maxDepth));
  this.maxFacts=Math.max(10,Math.min(2000,maxFacts));
  this.rules=[];
  for(const rule of rules)this.addRule(rule);
 }
 addRule(rule){
  const when=rule?.when??rule?.if;
  const then=rule?.then;
  if(!when||!then)throw new TypeError("Rule requires an if/when condition and a then conclusion.");
  const conclusion=Array.isArray(then)?{subject:then[0],relation:then[1],object:then[2]}:then;
  for(const field of ["subject","relation","object"])if(typeof conclusion[field]!=="string"||!conclusion[field].trim())throw new TypeError("Rule conclusion fields must be non-empty strings.");
  if(!Array.isArray(when)&&!when.all&&!when.any&&!when.not&&!when.fact&&!(when.subject&&when.relation&&when.object))throw new TypeError("Unsupported rule condition.");
  const normalized={id:String(rule.id||"rule-"+(this.rules.length+1)),when,then:{...conclusion},confidence:clamp01(rule.confidence??0.7),label:String(rule.label||rule.id||"custom-rule"),description:String(rule.description||"")};
  this.rules.push(normalized);return normalized;
 }
 evaluateCondition(condition,context={}){
  if(Array.isArray(condition))return condition.every(c=>this.evaluateCondition(c,context)===true)?true:condition.some(c=>this.evaluateCondition(c,context)===false)?false:null;
  if(condition?.all){
   const values=condition.all.map(c=>this.evaluateCondition(c,context));
   if(values.includes(false))return false;
   return values.every(v=>v===true)?true:null;
  }
  if(condition?.any){
   const values=condition.any.map(c=>this.evaluateCondition(c,context));
   if(values.includes(true))return true;
   return values.every(v=>v===false)?false:null;
  }
  if(condition?.not){
   const value=this.evaluateCondition(condition.not,context);
   return value===true?false:value===false?true:null;
  }
  const actual=context[condition?.field],expected=condition?.value;
  if(condition?.op==="exists")return actual!==undefined&&actual!==null;
  if(actual===undefined||actual===null)return null;
  switch(condition?.op){
   case "eq":return actual===expected;
   case "neq":return actual!==expected;
   case "gt":return Number(actual)>Number(expected);
   case "gte":return Number(actual)>=Number(expected);
   case "lt":return Number(actual)<Number(expected);
   case "lte":return Number(actual)<=Number(expected);
   case "contains":return Array.isArray(actual)?actual.includes(expected):String(actual).includes(String(expected??""));
   case "truthy":return Boolean(actual);
   default:return null;
  }
 }
 evaluateFactCondition(condition,facts=[]){
  if(Array.isArray(condition))condition={all:condition};
  if(!condition||typeof condition!=="object")return "unknown";
  if(Array.isArray(condition.all)){
   const values=condition.all.map(c=>this.evaluateFactCondition(c,facts));
   if(values.includes("false"))return "false";
   return values.every(v=>v==="true")?"true":"unknown";
  }
  if(Array.isArray(condition.any)){
   const values=condition.any.map(c=>this.evaluateFactCondition(c,facts));
   if(values.includes("true"))return "true";
   return values.every(v=>v==="false")?"false":"unknown";
  }
  if(condition.not){
   const value=this.evaluateFactCondition(condition.not,facts);
   return value==="true"?"false":value==="false"?"true":"unknown";
  }
  const pattern=condition.fact||condition;
  if(!pattern.subject||!pattern.relation||!pattern.object)return "unknown";
  if(facts.some(f=>factMatches(pattern,f)&&f.polarity!==false))return "true";
  if(facts.some(f=>factMatches(pattern,f)&&f.polarity===false))return "false";
  return "unknown";
 }
 decideIfElse({if:condition,then:thenValue,else:elseValue},facts=[],context={}){
  const status=condition?.op?this.evaluateCondition(condition,context):this.evaluateFactCondition(condition,facts);
  if(status===true||status==="true")return {status:"true",branch:"then",value:thenValue,reason:"Condition has explicit supporting evidence."};
  if(status===false||status==="false")return {status:"false",branch:"else",value:elseValue,reason:"Condition has explicit contradictory evidence."};
  return {status:"unknown",branch:"undetermined",value:null,reason:"Missing evidence is not treated as false."};
 }
 decide(branches,context={}){
  let unknown=false;
  for(const branch of branches||[]){
   const values=(branch.when||[]).map(c=>this.evaluateCondition(c,context));
   if(values.every(v=>v===true))return {value:branch.value,rule:branch.label||"if",status:"true"};
   if(!values.some(v=>v===false))unknown=true;
  }
  if(unknown)return {value:null,rule:"undetermined",status:"unknown"};
  const fallback=(branches||[]).find(b=>b.else===true);
  return fallback?{value:fallback.value,rule:fallback.label||"else",status:"false"}:{value:null,rule:"no-matching-rule",status:"false"};
 }
 matchingPremises(condition,facts=[]){
  if(Array.isArray(condition))return condition.flatMap(c=>this.matchingPremises(c,facts));
  if(condition?.all)return condition.all.flatMap(c=>this.matchingPremises(c,facts));
  if(condition?.any)return condition.any.flatMap(c=>this.matchingPremises(c,facts)).slice(0,8);
  if(condition?.not)return [];
  const pattern=condition?.fact||condition;
  return facts.filter(f=>factMatches(pattern,f)&&f.polarity!==false);
 }
 forwardChain(initialFacts=[]){
  const facts=initialFacts.map(f=>({...f,confidence:clamp01(f.confidence??0.6),derived:false}));
  const seen=new Set(facts.map(key)),trace=[];
  let changed=true,depth=0,steps=0;
  while(changed&&depth<this.maxDepth&&facts.length<this.maxFacts&&steps<256){
   changed=false;depth++;
   for(const rule of this.rules){
    steps++;
    if(this.evaluateFactCondition(rule.when,facts)!=="true")continue;
    const premises=this.matchingPremises(rule.when,facts),premiseConfidence=premises.length?Math.min(...premises.map(f=>clamp01(f.confidence??0.6))):0.5;
    const next={...rule.then,source:"rule-inference",confidence:Math.min(premiseConfidence,rule.confidence),derived:true,depth,rule:rule.id,provenance:{ruleId:rule.id,premises:premises.map(key),description:rule.description}};
    const k=key(next);if(seen.has(k))continue;
    seen.add(k);facts.push(next);trace.push({depth,rule:rule.id,premises:premises.map(key),conclusion:k,confidence:next.confidence});changed=true;
    if(facts.length>=this.maxFacts||steps>=256)break;
   }
  }
  return {facts,trace,steps,complete:!changed,limited:changed};
 }
 inferDefinition(memory,subject){
  const all=Array.isArray(memory?.semantic)?memory.semantic:[];
  const direct=all.filter(f=>norm(f.subject)===norm(subject));
  const chained=this.forwardChain(all);
  const derived=chained.facts.filter(f=>f.derived&&norm(f.subject)===norm(subject));
  // Preserve the original transparent two-link category inference: A is-a B; B belongs-to C => A has inferred category C.
  for(const first of direct){
   if(!CATEGORY_RELATIONS.has(norm(first.relation)))continue;
   for(const second of all){
    if(norm(second.subject)===norm(first.object)&&CATEGORY_RELATIONS.has(norm(second.relation))){
     derived.push({subject:first.subject,relation:"có quan hệ suy ra là",object:second.object,source:"two-link-inference",confidence:Math.min(Number(first.confidence)||0,Number(second.confidence)||0)*0.8,derived:true,rule:"transitive-category-link"});
    }
   }
  }
  const facts=[],seen=new Set();
  for(const fact of [...direct,...derived]){const k=key(fact);if(!seen.has(k)){seen.add(k);facts.push(fact);}}
  const conflicts=[];
  for(const fact of facts){
   const alternatives=all.filter(other=>norm(other.subject)===norm(fact.subject)&&norm(other.relation)===norm(fact.relation)&&norm(other.object)!==norm(fact.object));
   if(alternatives.length)conflicts.push({fact,alternatives});
  }
  const inferred=facts.some(f=>f.derived);
  const baseConfidence=facts.length?Math.max(...facts.map(f=>Number(f.confidence)||0)):0;
  return {facts,conflicts,method:inferred?"direct-recall+rule-inference":"direct-recall",confidence:baseConfidence*(conflicts.length?0.65:1),trace:chained.trace.filter(item=>facts.some(f=>f.derived&&key(f)===item.conclusion))};
 }
 export(){return this.rules.map(r=>({id:r.id,when:r.when,then:r.then,confidence:r.confidence,label:r.label,description:r.description}));}
}
