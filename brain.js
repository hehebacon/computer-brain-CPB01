/* CPB-01 cognitive kernel: language interface + bounded cognitive core. */
import { analyzeText, analyzeFile, inputEngineStats, registerInputAdapter, INPUT_ENGINE_VERSION } from "./input-engine.js";
import { CognitiveCore, CognitiveMemory } from "./cognitive-core.js";
import { registerLanguagePack, detectLanguageHint } from "./human-cognitive-systems.js";
import { PersonalizationModel } from "./personalization.js";
import { SearchClient } from "./search-client.js";
import { composeSearchAnswer } from "./answer-synthesizer.js";
import { CodeWorkbench, createCodeMarkdown, renderMarkdownPreview, mountSandbox } from "./code-workbench.js";
import { DirectSearchAdapter, buildPublicSearchLinks } from "./direct-search.js";
import { LearningEngine } from "./learning/learning-engine.js";
import { AssociationEngine } from "./learning/association-engine.js";
import { ResearchAgent } from "./learning/research-agent.js";
import { UpdateAuditLog } from "./learning/update-audit-log.js";
(() => {
 const STORAGE_KEY="cpb01-cognitive-memory-v3";
 const LEARNING_KEY="cpb01-learning-v1";
 const AUDIT_KEY="cpb01-update-audit-v1";
 const memory=new CognitiveMemory();
 const learning=new LearningEngine();
 const associations=new AssociationEngine();
 const audit=new UpdateAuditLog({sink:async record=>{try{const data=JSON.parse(localStorage.getItem(AUDIT_KEY)||'{"records":[]}');data.records.push(record);data.tail=record.hash;localStorage.setItem(AUDIT_KEY,JSON.stringify(data));}catch{}}});
 const state={turns:0,lastRepresentation:null};
 let saved=null;
 try{
  saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
  if(saved&&saved.memory)memory.import(saved.memory);
  else if(saved&&Array.isArray(saved.facts))for(const f of saved.facts)memory.learn(f.subject,f.relation,f.object,"legacy-memory",0.6);
  if(saved)state.turns=Number(saved.turns)||0;
  const learningData=JSON.parse(localStorage.getItem(LEARNING_KEY)||"null");
  if(learningData)learning.import(learningData);
 }catch{}
 const core=new CognitiveCore(memory,{...(saved?.hcs||{}),reasoningRules:saved?.reasoningRules||[]});
 const personalization=new PersonalizationModel(saved?.personalization||{});
 const searchClient=new SearchClient(saved?.search?.endpoint||"");
 const researchAgent=new ResearchAgent({search:(query,options)=>searchClient.search(query,options),learning});
 const directSearch=new DirectSearchAdapter();
 const codeWorkbench=new CodeWorkbench();
 function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({memory:memory.export(),turns:state.turns,hcs:core.hcs.export(),reasoningRules:core.reasoner.export(),personalization:personalization.export(),search:{endpoint:searchClient.endpoint}}));localStorage.setItem(LEARNING_KEY,JSON.stringify(learning.export()));}catch{}}
 function respond(text){
  const representation=analyzeText(String(text??""));
  state.lastRepresentation=representation;state.turns++;
  const preferenceUpdate=personalization.observe(String(text??""));
  const result=core.process(text,representation);
  const adaptation=core.hcs.recordOutcome({confidence:result.confidence,question:core.lastHCS?.question});
  if(preferenceUpdate.changed)result.text="Đã cập nhật cách trả lời: "+Object.entries(preferenceUpdate.changes).map(([k,v])=>k+" = "+v).join(", ")+".";
  result.text=personalization.adaptText(result.text,{mode:adaptation.adaptation,confidence:result.confidence});
  result.trace.push({stage:"agent-affect-adaptation",mode:adaptation.adaptation,agentState:adaptation.agentAffect.label,agentScore:adaptation.agentAffect.score});
  save();
  return {text:result.text,turns:state.turns,facts:memory.semantic.length,engine:"cpb01-cognitive-core",representation,reasoning:{cycle:core.cycle,confidence:result.confidence,trace:result.trace},cognitiveProfile:core.lastHCS,personalization:personalization.snapshot(),adaptation};
 }
 window.CPB01={
  respond,
  analyze(text){state.lastRepresentation=analyzeText(text);return state.lastRepresentation;},
  async processFile(file){const result=await analyzeFile(file);state.lastRepresentation=result;return result;},
  stats(){const userAffect=core.hcs.affect.snapshot(),agentAffect=core.hcs.agentAffect.snapshot(),result={turns:state.turns,facts:memory.semantic.length,episodes:memory.episodes.length,concepts:memory.concepts.size,reasoningCycles:core.cycle,reasoningRules:core.reasoner.rules.length,familiarity:core.hcs.familiarity.snapshot(),affect:userAffect,userAffect,agentAffect,bond:core.hcs.bond.snapshot(),personalization:personalization.snapshot(),searchConfigured:searchClient.configured,searchEndpoint:searchClient.endpoint,lastCognitiveProfile:core.lastHCS,...inputEngineStats(),lastInputKind:state.lastRepresentation?state.lastRepresentation.kind:null};save();return result;},
  setAffect(score){const value=core.hcs.setAffect(score);save();return value;},
  resetAffect(){const value=core.hcs.resetAffect();save();return value;},
  setAgentAffect(score){const value=core.hcs.setAgentAffect(score);save();return value;},
  resetAgentAffect(){const value=core.hcs.resetAgentAffect();save();return value;},
  recordTaskOutcome(success,severity=1){const value=core.hcs.recordTaskOutcome(success,severity);save();return value;},
  setPreferences(next){const value=personalization.setPreferences(next);save();return value;},
  configureSearch(endpoint){const value=searchClient.configure(endpoint);save();return value;},
  search(query,options={}){
   const detected=detectLanguageHint(query).language||core.lastHCS?.language?.language||"vi";
   const language=options.language||(["vi","en","es","fr","de","pt","it","ru","ar","zh","ja","ko","hi"].includes(detected)?detected:"vi");
   return searchClient.search(query,{...options,language});
  },
  createCodeMarkdown(options){return createCodeMarkdown(options);},
  renderCodeMarkdown(markdown){return renderMarkdownPreview(markdown);},
  getCodeTemplate(name){return codeWorkbench.template(name);},
  runCode(source,options={}){return codeWorkbench.runJavaScript(source,options);},
  mountSandbox(options){return mountSandbox(options);},
  searchDirect(query,options={}){return directSearch.search(query,options);},
  async searchDirectAndAnswer(query,options={}){
   const detected=detectLanguageHint(query).language||"vi";
   const response=await directSearch.search(query,{...options,language:options.language||detected});
   const preferences=personalization.snapshot().preferences;
   const answerLanguage=preferences.language==="auto"?(detected==="en"?"en":"vi"):preferences.language;
   const answer=composeSearchAnswer(query,response.results,{preferences:{...preferences,language:answerLanguage},userAffect:core.hcs.affect.snapshot(),memoryFacts:memory.recall(query)});
   return {...response,answer};
  },
  buildSocialSearchLinks(query){return buildPublicSearchLinks(query);},
  searchLocal(query,limit=8){return memory.recall(query,limit);},
  learnKnowledge(claim,options={}){const item=learning.learn({claim,kind:options.kind||"claim",confidence:options.confidence??0.25});save();return item;},
  async researchKnowledge(topic,options={}){const result=await researchAgent.research(topic,options);save();return result;},
  searchKnowledge(query,limit=10){return learning.search(query,limit);},
  discoverAssociations(limit=100){return associations.discover(learning.export().items).slice(0,limit);},
  exportKnowledge(){return learning.export();},
  async recordUpdateEvent(event,data={}){const record=await audit.append({runId:data.runId||"manual",event,data});return record;},
  updateAudit(){try{return JSON.parse(localStorage.getItem(AUDIT_KEY)||'{"records":[],"tail":null}');}catch{return {records:[],tail:null};}},
  registerRule(rule){const added=core.registerRule(rule);save();return added;},
  reason(subject){return core.reason(subject);},
  runReasoning(){return core.runReasoning();},
  decideIfElse(decision,context={}){return core.decideIfElse(decision,context);},
  answerWithSearch(query,results){
   const preferences=personalization.snapshot().preferences;
   const detected=detectLanguageHint(query).language||core.lastHCS?.language?.language||"vi";
   const language=preferences.language==="auto"?(detected==="en"?"en":"vi"):preferences.language;
   return composeSearchAnswer(query,results,{preferences:{...preferences,language},userAffect:core.hcs.affect.snapshot(),memoryFacts:memory.recall(query)});
  },
  registerLanguagePack(pack){return registerLanguagePack(pack)},
  lastInput(){return state.lastRepresentation;},
  recall(query){return memory.recall(query);},
  registerAdapter:registerInputAdapter,
  clear(){memory.clear();state.turns=0;core.cycle=0;core.hcs.reset();save();}
 };
 window.dispatchEvent(new CustomEvent("cpb01-ready",{detail:{inputEngineVersion:INPUT_ENGINE_VERSION,coreVersion:"0.4.0"}}));
})();