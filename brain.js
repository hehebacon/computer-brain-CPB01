/* CPB-01 cognitive kernel: language interface + bounded cognitive core. */
import { analyzeText, analyzeFile, inputEngineStats, registerInputAdapter, INPUT_ENGINE_VERSION } from "./input-engine.js";
import { CognitiveCore, CognitiveMemory } from "./cognitive-core.js";
import { registerLanguagePack } from "./human-cognitive-systems.js";
import { PersonalizationModel } from "./personalization.js";
import { SearchClient } from "./search-client.js";
import { composeSearchAnswer } from "./answer-synthesizer.js";
(() => {
 const STORAGE_KEY="cpb01-cognitive-memory-v3";
 const memory=new CognitiveMemory();
 const state={turns:0,lastRepresentation:null};
 let saved=null;
 try{
  saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
  if(saved&&saved.memory)memory.import(saved.memory);
  else if(saved&&Array.isArray(saved.facts))for(const f of saved.facts)memory.learn(f.subject,f.relation,f.object,"legacy-memory",0.6);
  if(saved)state.turns=Number(saved.turns)||0;
 }catch{}
 const core=new CognitiveCore(memory,saved?.hcs||{});
 const personalization=new PersonalizationModel(saved?.personalization||{});
 const searchClient=new SearchClient(saved?.search?.endpoint||"");
 function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({memory:memory.export(),turns:state.turns,hcs:core.hcs.export(),personalization:personalization.export(),search:{endpoint:searchClient.endpoint}}));}catch{}}
 function respond(text){
  const representation=analyzeText(String(text??""));
  state.lastRepresentation=representation;state.turns++;
  const preferenceUpdate=personalization.observe(String(text??""));
  const result=core.process(text,representation);
  const adaptation=core.hcs.recordOutcome({confidence:result.confidence,question:core.lastHCS?.question});
  if(preferenceUpdate.changed)result.text="Đã cập nhật cách trả lời: "+Object.entries(preferenceUpdate.changes).map(([k,v])=>k+" = "+v).join(", ")+".";
  result.text=personalization.adaptText(result.text);
  save();
  return {text:result.text,turns:state.turns,facts:memory.semantic.length,engine:"cpb01-cognitive-core",representation,reasoning:{cycle:core.cycle,confidence:result.confidence,trace:result.trace},cognitiveProfile:core.lastHCS,personalization:personalization.snapshot(),adaptation};
 }
 window.CPB01={
  respond,
  analyze(text){state.lastRepresentation=analyzeText(text);return state.lastRepresentation;},
  async processFile(file){const result=await analyzeFile(file);state.lastRepresentation=result;return result;},
  stats(){return {turns:state.turns,facts:memory.semantic.length,episodes:memory.episodes.length,concepts:memory.concepts.size,reasoningCycles:core.cycle,familiarity:core.hcs.familiarity.snapshot(),affect:core.hcs.affect.snapshot(),userAffect:core.hcs.affect.snapshot(),agentAffect:core.hcs.agentAffect.snapshot(),personalization:personalization.snapshot(),lastCognitiveProfile:core.lastHCS,...inputEngineStats(),lastInputKind:state.lastRepresentation?state.lastRepresentation.kind:null};},
  setAffect(score){const value=core.hcs.setAffect(score);save();return value;},
  resetAffect(){const value=core.hcs.resetAffect();save();return value;},
  setPreferences(next){const value=personalization.setPreferences(next);save();return value;},
  configureSearch(endpoint){const value=searchClient.configure(endpoint);save();return value;},
  search(query,options={}){return searchClient.search(query,options);},
  answerWithSearch(query,results){return composeSearchAnswer(query,results,{preferences:personalization.snapshot().preferences,userAffect:core.hcs.affect.snapshot(),memoryFacts:memory.recall(query)});},
  registerLanguagePack(pack){return registerLanguagePack(pack)},
  lastInput(){return state.lastRepresentation;},
  recall(query){return memory.recall(query);},
  registerAdapter:registerInputAdapter,
  clear(){memory.clear();state.turns=0;core.cycle=0;core.hcs.reset();save();}
 };
 window.dispatchEvent(new CustomEvent("cpb01-ready",{detail:{inputEngineVersion:INPUT_ENGINE_VERSION,coreVersion:"0.3.0"}}));
})();