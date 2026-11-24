import test from "node:test";
import assert from "node:assert/strict";
import { planAnswer } from "../cognition/answer-planner.js";
import { CognitiveCore, CognitiveMemory } from "../cognitive-core.js";

test("answer planner retrieves relevant facts and preserves their source caveat",()=>{
 const memory=new CognitiveMemory();
 memory.learn("Sao Hỏa","là","hành tinh","user-stated",0.65);
 const plan=planAnswer({question:"Sao Hỏa là gì?",memory,questionProfile:{type:"definition"}});
 assert.equal(plan.goal,"answer-from-local-evidence");
 assert.match(plan.answer,/Sao Hỏa là hành tinh/);
 assert.match(plan.answer,/chưa được xác minh/);
 assert.equal(plan.evidence.length,1);
});

test("answer planner requests external evidence instead of inventing an answer",()=>{
 const plan=planAnswer({question:"Why do stars shine?",memory:new CognitiveMemory(),questionProfile:{type:"cause"}});
 assert.equal(plan.goal,"retrieve-external-evidence");
 assert.equal(plan.confidence,0);
 assert.equal(plan.searchQuery,"Why do stars shine");
});

test("cognitive core exposes a search plan when local evidence is missing",()=>{
 const core=new CognitiveCore(new CognitiveMemory());
 const result=core.process("Why do stars shine?",null);
 assert.equal(result.needsExternalEvidence,true);
 assert.equal(result.searchQuery,"Why do stars shine");
 assert.ok(result.trace.some(step=>step.stage==="answer-planning"&&step.goal==="retrieve-external-evidence"));
});

test("cognitive core answers non-definition questions from matching memory",()=>{
 const memory=new CognitiveMemory();
 memory.learn("Bầu trời","có màu","xanh do tán xạ ánh sáng","test",0.8);
 const result=new CognitiveCore(memory).process("Vì sao bầu trời có màu xanh?",null);
 assert.equal(result.needsExternalEvidence,undefined);
 assert.match(result.text,/Bầu trời có màu/);
 assert.ok(result.trace.some(step=>step.stage==="answer-planning"&&step.goal==="answer-from-local-evidence"));
});
