/* CPB-01 bounded symbolic reasoning engine.
 * Transparent forward chaining and explicit condition evaluation; no eval() or hidden model calls.
 */
const norm=value=>String(value??"").normalize("NFC").toLocaleLowerCase().trim();
const key=f=>[f.subject,f.relation,f.object].map(norm).join("|");
const MATCH_RELATIONS=new Set(["là","la","is-a","thuộc nhóm","thuoc nhom","belongs-to","thuộc","thuoc"]);
const clamp01=n=>Math.max(0,Math.min(1,Number(n)||0));

export class ReasoningEngine{
 constructor({maxDepth=4,maxFacts=500}={}){this.maxDepth=Math.max(1,Math.min(8,maxDepth));this.maxFacts=Math.max(10,Math.min(2000,maxFacts));this.rules=[];}
 addRule(rule){
  if(!rule?.if||!rule?.then)throw new TypeError("Rule requires if and then facts");
  for(const part of [rule.if,rule.then])for(const field of ["subject","relation","object"])if(typeof part[field]!=="string"||!part[field].trim())throw new TypeError("Rule fact fields must be non-empty strings");
  const normalized={if:{...rule.if},then:{...rule.then},confidence:clamp01(rule.confidence??0.7),label:String(rule.label||"custom-rule")};
  this.rules.push(normalized);return normalized;
 }
 evaluateCondition(condition,context={}){
  const actual=context[condition?.field],expected=condition?.value;
  switch(condition?.op){
   case "eq":return actual===expected;
   case "neq":return actual!==expected;
   case "gt":return Number(actual)>Number(expected);
   case "gte":return Number(actual)>=Number(expected);
   case "lt":return Number(actual)<Number(expected);
   case "lte":return Number(actual)<=Number(expected);
   case "contains":return Array.isArray(actual)?actual.includes(expected):String(actual??"").includes(String(expected??""));
   case "truthy":return Boolean(actual);
   case "exists":return actual!==undefined&&actual!==null;
   default:return false;
  }
 }
 decide(branches,context={}){
  for(const branch of branches||[])if(Array.isArray(branch.when)&&branch.when.every(c=>this.evaluateCondition(c,context)))return {value:branch.value,rule:branch.label||"if"};
  return {value:null,rule:"else"};
 }
 forwardChain(initialFacts=[]){
  const facts=initialFacts.map(f=>({...f,confidence:clamp01(f.confidence??0.6),derived:false}));
  const seen=new Set(facts.map(key)),trace=[];
  for(let depth=1;depth<=this.maxDepth&&facts.length<this.maxFacts;depth++){
   let changed=false;
   for(const rule of this.rules){
    const matches=facts.filter(f=>norm(f.subject)===norm(rule.if.subject)&&norm(f.relation)===norm(rule.if.relation)&&norm(f.object)===norm(rule.if.object));
    for(const premise of matches){
     const next={...rule.then,source:"rule-inference",confidence:Math.min(premise.confidence,rule.confidence),derived:true,depth,rule:rule.label};
     const k=key(next);if(seen.has(k))continue;
     seen.add(k);facts.push(next);trace.push({depth,rule:rule.label,premise:key(premise),conclusion:k,confidence:next.confidence});changed=true;
     if(facts.length>=this.maxFacts)break;
    }
    if(facts.length>=this.maxFacts)break;
   }
   if(!changed)break;
  }
  return {facts,trace};
 }
 inferDefinition(memory,subject){
  const all=Array.isArray(memory?.semantic)?memory.semantic:[];
  const direct=all.filter(f=>norm(f.subject)===norm(subject));
  const derived=[];
  for(const first of direct){
   if(!MATCH_RELATIONS.has(norm(first.relation)))continue;
   for(const second of all){
    if(norm(second.subject)===norm(first.object)&&MATCH_RELATIONS.has(norm(second.relation))){
     derived.push({subject:first.subject,relation:"có quan hệ suy ra là",object:second.object,source:"two-link-inference",confidence:Math.min(Number(first.confidence)||0,Number(second.confidence)||0)*0.8,derived:true,rule:"transitive-category-link"});
    }
   }
  }
  const unique=new Map();
  for(const fact of [...direct,...derived]){const k=key(fact);if(!unique.has(k))unique.set(k,fact);}
  const facts=[...unique.values()],conflicts=[];
  for(const fact of facts){
   const alternatives=all.filter(other=>norm(other.subject)===norm(fact.subject)&&norm(other.relation)===norm(fact.relation)&&norm(other.object)!==norm(fact.object));
   if(alternatives.length)conflicts.push({fact,alternatives});
  }
  const inferred=facts.some(f=>f.derived);
  return {facts,conflicts,method:inferred?"direct-recall+two-link-inference":"direct-recall",confidence:facts.length?Math.max(...facts.map(f=>Number(f.confidence)||0))*(conflicts.length?0.65:1):0,trace:derived.map(f=>({rule:f.rule,conclusion:key(f),confidence:f.confidence}))};
 }
}
