import test from "node:test";
import assert from "node:assert/strict";
import { AffectiveState, BondTrustModel, HumanCognitiveSystems } from "../human-cognitive-systems.js";
import { CognitiveCore, CognitiveMemory } from "../cognitive-core.js";
import { ReasoningEngine } from "../reasoning-engine.js";
import { buildSandboxDocument, buildWorkerSource, createCodeMarkdown, renderMarkdownPreview, CodeWorkbench, CODE_TEMPLATES, CODE_LIMITS } from "../code-workbench.js";

test("mood recovers from elapsed wall-clock time without neutral messages",()=>{
 const now=Date.now(),mood=new AffectiveState({score:80,lastUpdatedAt:now});
 assert.equal(mood.snapshot(now+8*60*60*1000).score,0);
});

test("long-term bond rises slowly and a confirmed mistake reduces it more",()=>{
 const bond=new BondTrustModel({score:0,lastUpdatedAt:Date.now()}),start=Date.now();
 bond.recordOutcome({success:true,at:start});
 const afterOne=bond.snapshot().score;
 bond.recordOutcome({success:true,at:start+86400000});
 bond.recordOutcome({success:true,at:start+2*86400000});
 assert.ok(bond.snapshot().score>afterOne);
 const beforeFailure=bond.snapshot().score;
 bond.recordOutcome({success:false,severity:1,at:start+3*86400000});
 assert.ok(bond.snapshot().score<beforeFailure);
 assert.ok(bond.snapshot().score>=0);
});

test("HCS records explicit correction feedback separately from short-term mood",()=>{
 const hcs=new HumanCognitiveSystems(),before=hcs.bond.snapshot().score;
 const profile=hcs.process("Bạn trả lời sai rồi.");
 assert.ok(profile.bond.failures>0);
 assert.equal(hcs.bond.snapshot().score,before);
 const outcome=hcs.recordOutcome({confidence:0.1,question:profile.question});
 assert.equal(outcome.agentAffect.mode,"Sai sót cần khắc phục");
 assert.ok(outcome.bond.failures>0);
});

test("reasoning engine supports explicit IF/ELSE decisions",()=>{
 const engine=new ReasoningEngine();
 const result=engine.decide([
  {label:"known",when:[{field:"confidence",op:"gte",value:0.8},{field:"hasEvidence",op:"truthy"}],value:"answer"},
  {label:"fallback",when:[{field:"question",op:"truthy"}],value:"ask-for-source"}
 ],{confidence:0.9,hasEvidence:true,question:true});
 assert.deepEqual(result,{value:"answer",rule:"known"});
 assert.deepEqual(engine.decide([]),{value:null,rule:"else"});
});

test("reasoning engine performs bounded forward chaining and detects conflicting facts",()=>{
 const engine=new ReasoningEngine({maxDepth:2});
 engine.addRule({if:{subject:"Sao Hỏa",relation:"là",object:"hành tinh"},then:{subject:"Sao Hỏa",relation:"thuộc nhóm",object:"thiên thể"},confidence:0.8,label:"planet-is-celestial"});
 const chained=engine.forwardChain([{subject:"Sao Hỏa",relation:"là",object:"hành tinh",confidence:0.9}]);
 assert.equal(chained.facts.length,2);
 assert.equal(chained.trace[0].rule,"planet-is-celestial");
 const inferred=engine.inferDefinition({semantic:[
  {subject:"Sao Hỏa",relation:"là",object:"hành tinh",confidence:0.9},
  {subject:"Sao Hỏa",relation:"là",object:"ngôi sao",confidence:0.5},
  {subject:"hành tinh",relation:"thuộc nhóm",object:"thiên thể",confidence:0.8}
 ]},"Sao Hỏa");
 assert.ok(inferred.conflicts.length>0);
 assert.ok(inferred.facts.some(f=>f.object==="thiên thể"));
 assert.ok(inferred.confidence<0.9);
});

test("Markdown code artifact uses a safe fence around embedded backticks",()=>{
 const tick=String.fromCharCode(96);
 const markdown=createCodeMarkdown({title:"Demo",language:"javascript",code:"const x = "+tick+"value"+tick+";\n// "+tick.repeat(3)+" inside"});
 assert.match(markdown,/^# Demo/m);
 assert.ok(markdown.includes(tick.repeat(4)+"javascript"));
});

test("HTML preview strips active content and applies restrictive CSP",()=>{
 const html=buildSandboxDocument("<html><head></head><body><h1 onclick='bad()'>Hi</h1><script>alert(1)</script><img src=x onerror='bad()'></body></html>");
 assert.match(html,/Content-Security-Policy/);
 assert.match(html,/script-src 'none'/);
 assert.doesNotMatch(html,/<script/i);
 assert.doesNotMatch(html,/onclick|onerror/i);
 assert.match(html,/<h1/);
 assert.throws(()=>buildSandboxDocument("x".repeat(CODE_LIMITS.maxBytes+1)),RangeError);
});

test("JavaScript worker source disables common network and persistence APIs",()=>{
 const source=buildWorkerSource("return 6 * 7;");
 assert.ok(source.includes("'fetch'"));
 assert.match(source,/XMLHttpRequest/);
 assert.match(source,/indexedDB/);
 assert.match(source,/__run\(\)/);
});

test("Markdown preview escapes raw HTML and renders fenced code",()=>{
 const fence=String.fromCharCode(96).repeat(3);
 const markdown=["# Demo","","<script>alert(1)</script>","",fence+"js","const answer = 42;",fence].join("\n");
 const html=renderMarkdownPreview(markdown);
 assert.match(html,/<h1>Demo<\/h1>/);
 assert.doesNotMatch(html,/<script>alert/);
 assert.match(html,/tok-keyword/);
});

test("code templates and worker runner return output and enforce timeout",async()=>{
 assert.ok(CODE_TEMPLATES["html-starter"]);
 let terminated=false;
 const fake={postMessage(){queueMicrotask(()=>this.onmessage({data:{type:"cpb01-result",ok:true,result:"42",logs:""}}));},terminate(){terminated=true;}};
 const wb=new CodeWorkbench({workerFactory:()=>fake});
 const result=await wb.runJavaScript("return 42;",{timeoutMs:500});
 assert.equal(result.result,"42");
 assert.equal(terminated,true);
 let timeoutTerminated=false;
 const slow=new CodeWorkbench({workerFactory:()=>({postMessage(){},terminate(){timeoutTerminated=true;}})});
 const timed=await slow.runJavaScript("while(true){}",{timeoutMs:250});
 assert.equal(timed.timedOut,true);
 assert.equal(timeoutTerminated,true);
});

test("end-to-end cognitive loop stores, retrieves, infers, and tracks user feedback",()=>{
 const memory=new CognitiveMemory(),core=new CognitiveCore(memory);
 memory.learn("Sao Hỏa","là","hành tinh","e2e-seed",0.95);
 memory.learn("hành tinh","thuộc nhóm","thiên thể","e2e-seed",0.9);
 const answer=core.process("Sao Hỏa là gì?",null);
 assert.match(answer.text,/thiên thể/);
 assert.ok(answer.trace.some(stage=>stage.stage==="reasoning"&&stage.inferenceTrace.length>0));
 const praise=core.process("Bạn làm tốt lắm, cảm ơn!",null);
 const mood=core.hcs.affect.snapshot().score;
 const outcome=core.hcs.recordOutcome({confidence:0.9,question:core.lastHCS.question});
 assert.ok(praise.text.length>0);
 assert.ok(Number.isFinite(mood));
 assert.ok(outcome.bond.score>=0);
});
