import test from "node:test";
import assert from "node:assert/strict";
import { LearningEngine } from "../learning/learning-engine.js";
import { AssociationEngine } from "../learning/association-engine.js";
import { assessSource } from "../learning/source-verifier.js";
import { SelfImprovementRunner } from "../learning/self-improvement-runner.js";
import { UpdateAuditLog } from "../learning/update-audit-log.js";

test("learning retains source provenance and does not overstate one-source evidence",()=>{
 const engine=new LearningEngine({clock:()=>0});
 engine.addSource({id:"s1",url:"https://example.org/a",title:"A",publisher:"Example",family:"example.org"});
 const item=engine.learn({id:"k1",claim:"CPB learns from evidence",sourceId:"s1",kind:"claim",confidence:.7});
 assert.equal(item.state,"SUPPORTED");
 assert.equal(item.evidence.length,1);
 engine.addSource({id:"s2",url:"https://university.edu/b",title:"B",publisher:"University",family:"university.edu"});
 assert.equal(engine.learn({id:"k1",claim:item.claim,sourceId:"s2"}).state,"CORROBORATED");
});

test("source verifier treats institutional domains as hints, not proof",()=>{
 const result=assessSource({url:"https://agency.gov/report",title:"Report",publisher:"Agency"});
 assert.equal(result.accepted,true);
 assert.equal(result.verified,false);
 assert.equal(result.institutionalHint,true);
 assert.equal(assessSource({url:"http://agency.gov"}).accepted,false);
});

test("association engine labels lexical matches as candidates",()=>{
 const rows=[{id:"a",claim:"machine learning knowledge graph"},{id:"b",claim:"knowledge graph machine reasoning"}];
 const found=new AssociationEngine({minSharedTerms:2}).discover(rows);
 assert.equal(found.length,1);
 assert.equal(found[0].status,"CANDIDATE");
});

test("audit log creates and verifies a hash chain",async()=>{
 const log=new UpdateAuditLog();
 await log.append({runId:"r1",event:"STARTED"});
 await log.append({runId:"r1",event:"PASSED"});
 assert.equal((await log.verify()).valid,true);
 const tampered=log.export().records.map(x=>({...x}));
 tampered[0].event="ALTERED";
 assert.equal((await log.verify(tampered)).valid,false);
});

test("update runner logs and rolls back a rejected candidate",async()=>{
 const events=[];let rolledBack=false;
 const runner=new SelfImprovementRunner({
  research:async()=>[{claim:"finding"}],
  propose:async()=>({paths:["modules/new-module.js"]}),
  apply:async()=>({commit:"candidate"}),
  validate:async()=>({testsPassed:false,buildPassed:true,regressionCount:0,securityChecksPassed:true,resourceBudgetRespected:true,qualityScore:2}),
  activate:async()=>{},
  rollback:async()=>{rolledBack=true;return {restored:"baseline"};},
  audit:async event=>events.push(event)
 });
 await assert.rejects(()=>runner.run({topic:"test",baseline:{qualityScore:1}}),/Candidate rejected/);
 assert.equal(rolledBack,true);
 assert.ok(events.some(x=>x.event==="RECOVERY_COMPLETED"));
});

test("update runner activates only after all gates pass",async()=>{
 const events=[];let activated=false;
 const runner=new SelfImprovementRunner({
  research:async()=>[],
  propose:async()=>({paths:["modules/new-module.js"]}),
  apply:async()=>({commit:"candidate"}),
  validate:async()=>({testsPassed:true,buildPassed:true,regressionCount:0,securityChecksPassed:true,resourceBudgetRespected:true,qualityScore:2}),
  activate:async()=>{activated=true;},
  rollback:async()=>{},
  audit:async event=>events.push(event)
 });
 const result=await runner.run({topic:"test",baseline:{qualityScore:1}});
 assert.equal(activated,true);
 assert.equal(result.status,"ACTIVATED");
 assert.ok(events.some(x=>x.event==="ACTIVATED"));
});
