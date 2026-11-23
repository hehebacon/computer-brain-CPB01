import test from "node:test";
import assert from "node:assert/strict";
import { AffectiveState, AgentAffectModel, BondTrustModel, HumanCognitiveSystems, recognizeEmotion } from "../human-cognitive-systems.js";
import { CognitiveCore, CognitiveMemory } from "../cognitive-core.js";
import { ReasoningEngine } from "../reasoning-engine.js";
import { CodeWorkbench, CODE_TEMPLATES, createCodeMarkdown, renderMarkdownPreview, buildSandboxDocument, buildWorkerSource } from "../code-workbench.js";
import { DirectSearchAdapter, buildPublicSearchLinks } from "../direct-search.js";

test("mood restores to neutral after an eight-hour tab sleep and persists its timestamp",()=>{
 const start=Date.now();
 const mood=new AffectiveState({score:100,lastUpdatedAt:start});
 const stored=mood.export();
 assert.equal(typeof stored.lastUpdatedAt,"number");
 assert.ok(stored.lastUpdatedAt>=start);
 const afterSleep=mood.snapshot(start+8*60*60*1000);
 assert.equal(afterSleep.score,0);
 assert.equal(afterSleep.direction,"neutral");
});

test("internal agent mood also returns to neutral after an eight-hour pause",()=>{
 const start=Date.now();
 const mood=new AgentAffectModel({score:100,lastUpdatedAt:start});
 assert.equal(mood.snapshot(start+8*60*60*1000).score,0);
});

test("mood recovers independently from long-term bond",()=>{
 const start=Date.now();
 const mood=new AffectiveState({score:-90,lastUpdatedAt:start});
 const bond=new BondTrustModel({score:40,lastUpdatedAt:start});
 mood.snapshot(start+8*60*60*1000);
 assert.equal(mood.snapshot(start+8*60*60*1000).score,0);
 assert.equal(bond.snapshot().score,40);
});

test("bond grows slowly by distinct days and explicit positive feedback",()=>{
 const start=Date.UTC(2026,0,1,12);
 const bond=new BondTrustModel({lastUpdatedAt:start});
 bond.observeFeedback("Cảm ơn bạn, làm tốt lắm!",recognizeEmotion("Cảm ơn bạn, làm tốt lắm!"),start);
 const dayOne=bond.snapshot().score;
 bond.observeFeedback("Cảm ơn lần nữa",recognizeEmotion("Cảm ơn lần nữa"),start+3600000);
 assert.equal(bond.snapshot().score,dayOne+1);
 bond.observeFeedback("Tuyệt vời, cảm ơn!",recognizeEmotion("Tuyệt vời, cảm ơn!"),start+86400000);
 assert.ok(bond.snapshot().score>dayOne+1);
 assert.equal(bond.snapshot().positiveDays,2);
 assert.equal(bond.snapshot().unbounded,true);
});

test("explicit correction causes an asymmetric bond penalty and cautious agent mood",()=>{
 const start=Date.UTC(2026,1,1,12);
 const bond=new BondTrustModel({score:50,lastUpdatedAt:start});
 bond.observeFeedback("Sai rồi, câu trả lời không đúng",recognizeEmotion("Sai rồi, câu trả lời không đúng"),start);
 assert.ok(bond.snapshot().score<50);
 assert.ok(bond.snapshot().trustDebt>0);
 const hcs=new HumanCognitiveSystems();
 hcs.process("Sai rồi, bạn trả lời không đúng");
 const result=hcs.recordOutcome({confidence:0.2});
 assert.equal(result.adaptation,"cautious");
 assert.equal(result.agentAffect.mode,"Sai sót cần khắc phục");
});

test("reasoner distinguishes false evidence from unknown and runs multi-step IF rules",()=>{
 const engine=new ReasoningEngine({maxDepth:5});
 engine.addRule({id:"dog-is-mammal",if:{subject:"Milo",relation:"type",object:"dog"},then:{subject:"Milo",relation:"type",object:"mammal"},confidence:0.9});
 engine.addRule({id:"mammal-is-animal",if:{subject:"Milo",relation:"type",object:"mammal"},then:{subject:"Milo",relation:"type",object:"animal"},confidence:0.8});
 const facts=[{subject:"Milo",relation:"type",object:"dog",confidence:1}];
 const chain=engine.forwardChain(facts);
 assert.ok(chain.facts.some(f=>f.object==="animal"&&f.derived));
 assert.ok(chain.trace.length>=2);
 const unknown=engine.decideIfElse({if:{subject:"Milo",relation:"type",object:"bird"},then:"bird",else:"not bird"},facts);
 assert.equal(unknown.branch,"undetermined");
 const contradicted=engine.decideIfElse({if:{subject:"Milo",relation:"type",object:"bird"},then:"bird",else:"not bird"},[...facts,{subject:"Milo",relation:"type",object:"bird",polarity:false}]);
 assert.equal(contradicted.branch,"else");
});

test("CognitiveCore persists rule-based reasoning provenance into a question path",()=>{
 const memory=new CognitiveMemory();
 const core=new CognitiveCore(memory);
 memory.learn("Milo","là","chó","user-stated",0.8);
 core.registerRule({id:"dog-is-mammal",if:{subject:"Milo",relation:"là",object:"chó"},then:{subject:"Milo",relation:"là",object:"động vật có vú"},confidence:0.85});
 const savedRules=core.reasoner.export();
 assert.equal(savedRules.length,1);
 assert.ok(core.reason("Milo").facts.some(f=>f.derived&&f.object==="động vật có vú"));
});

test("Markdown workbench emits fenced source and escaped highlighted preview",()=>{
 const code="const message = \"<script>alert(1)</script>\";";
 const markdown=createCodeMarkdown({title:"Safe sample",language:"javascript",code,notes:["Preview safely"]});
 const html=renderMarkdownPreview(markdown);
 assert.match(markdown,/\u0060{3}javascript/);
 assert.match(html,/<h1>Safe sample<\/h1>/);
 assert.match(html,/tok-keyword/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script>/);
 assert.ok(CODE_TEMPLATES["html-starter"].code.includes("<!doctype html>"));
});

test("HTML preview removes active scripts, event handlers and embeds restrictive CSP",()=>{
 const html=buildSandboxDocument('<main onclick="alert(1)">Preview</main><script>while(true){}</script><iframe src="https://evil.example"></iframe>');
 assert.match(html,/script-src 'none'/);
 assert.match(html,/connect-src 'none'/);
 assert.doesNotMatch(html,/<script>/i);
 assert.doesNotMatch(html,/onclick=/i);
 assert.doesNotMatch(html,/<iframe/i);
});

test("JavaScript worker runner returns output and terminates on timeout",async()=>{
 let completedTerminated=false;
 const fastWorker={
  postMessage(){setTimeout(()=>this.onmessage({data:{type:"cpb01-result",ok:true,result:"42",logs:"hello"}}),1);},
  terminate(){completedTerminated=true;}
 };
 const workbench=new CodeWorkbench({workerFactory:()=>fastWorker});
 const result=await workbench.runJavaScript("return 42;");
 assert.equal(result.ok,true);
 assert.equal(result.result,"42");
 assert.equal(result.logs,"hello");
 assert.equal(completedTerminated,true);
 let timeoutTerminated=false;
 const stuckWorker={postMessage(){},terminate(){timeoutTerminated=true;}};
 const timed=await new CodeWorkbench({workerFactory:()=>stuckWorker}).runJavaScript("while(true){}",{timeoutMs:250});
 assert.equal(timed.timedOut,true);
 assert.equal(timeoutTerminated,true);
 assert.match(buildWorkerSource("return 1;"),/fetch.*XMLHttpRequest/);
 assert.throws(()=>buildWorkerSource("x".repeat(170000)),/160 KB/);
});

test("direct search queries a public index without API key, Worker, or model tokens",async()=>{
 let requested=null;
 const adapter=new DirectSearchAdapter({fetchImpl:async url=>{
  requested=new URL(url);
  return new Response(JSON.stringify({query:{search:[
   {title:"Trái Đất",snippet:"Hành tinh thứ ba trong Hệ Mặt Trời.",timestamp:"2026-01-01T00:00:00Z",size:1024}
  ]}}),{status:200,headers:{"content-type":"application/json"}});
 }});
 const result=await adapter.search("Trái Đất",{language:"vi",count:5});
 assert.equal(requested.hostname,"vi.wikipedia.org");
 assert.equal(result.tokenUsage,0);
 assert.equal(result.workerRequests,0);
 assert.equal(result.results[0].title,"Trái Đất");
 assert.match(result.results[0].url,/wikipedia\.org/);
 assert.equal(buildPublicSearchLinks("CPB-01").length,5);
});

test("public social search links are generated locally without a proxy call",()=>{
 const links=buildPublicSearchLinks("CPB-01");
 assert.ok(links.every(link=>link.url.startsWith("https://")));
 assert.ok(links.some(link=>link.name==="Reddit public search"));
});


test("confirmed task failure lowers both Bond and internal agent state",()=>{
 const h=new HumanCognitiveSystems();
 h.bond.recordOutcome({success:true,at:Date.UTC(2026,2,1,12)});
 const before=h.bond.snapshot().score;
 const result=h.recordTaskOutcome(false,2);
 assert.ok(result.bond.score<before);
 assert.ok(result.bond.trustDebt>0);
 assert.equal(result.agentAffect.mode,"Sai sót cần khắc phục");
 assert.equal(result.adaptation,"cautious");
});

test("confirmed task success only adds a capped trust increment",()=>{
 const h=new HumanCognitiveSystems();
 h.recordTaskOutcome(true,1);
 const before=h.bond.snapshot().score;
 const result=h.recordTaskOutcome(true,1);
 assert.equal(result.bond.score-before,1);
 assert.ok(h.bond.snapshot().dailyGain<=2);
});


test("repeating the same correction within five minutes does not stack Bond or agent mood penalties",()=>{
 const h=new HumanCognitiveSystems();
 const first=h.process("Sai rồi, câu trả lời không đúng");
 const afterFirstBond=h.bond.snapshot();
 const firstOutcome=h.recordOutcome({confidence:0.2,question:first.question});
 const afterFirstAgent=firstOutcome.agentAffect.score;
 const second=h.process("Sai rồi, câu trả lời không đúng");
 assert.equal(second.bond.lastOutcome,"duplicate-correction");
 const secondOutcome=h.recordOutcome({confidence:0.2,question:second.question});
 assert.equal(secondOutcome.bond.score,afterFirstBond.score);
 assert.equal(secondOutcome.bond.trustDebt,afterFirstBond.trustDebt);
 assert.equal(secondOutcome.agentAffect.score,afterFirstAgent);
 assert.equal(secondOutcome.adaptation,"cautious");
});


test("IF/ELSE supports compound context conditions without treating missing fields as false",()=>{
 const engine=new ReasoningEngine();
 const decision=engine.decideIfElse({
  if:{all:[{field:"score",op:"gt",value:5},{field:"ready",op:"eq",value:true}]},
  then:"continue",
  else:"stop"
 },[],{score:9,ready:true});
 assert.equal(decision.branch,"then");
 const unknown=engine.decideIfElse({
  if:{all:[{field:"score",op:"gt",value:5},{field:"ready",op:"eq",value:true}]},
  then:"continue",
  else:"stop"
 },[],{score:9});
 assert.equal(unknown.branch,"undetermined");
});
