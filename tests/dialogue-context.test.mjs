import test from "node:test";
import assert from "node:assert/strict";
import { ContextManager } from "../cognition/context-manager.js";
import { DialogueManager } from "../cognition/dialogue-manager.js";
import { CognitiveCore, CognitiveMemory } from "../cognitive-core.js";

test("dialogue manager resolves pronouns using the active topic",()=>{
 const dialogue=new DialogueManager();
 const result=dialogue.resolve("Nó quay quanh gì?",{currentTopic:"Trái Đất"});
 assert.equal(result.usedContext,true);
 assert.equal(result.text,"Trái Đất quay quanh gì?");
 assert.equal(result.topic,"Trái Đất");
});

test("standalone questions are not rewritten by unrelated context",()=>{
 const result=new DialogueManager().resolve("Mặt Trăng là gì?",{currentTopic:"Trái Đất"});
 assert.equal(result.usedContext,false);
 assert.equal(result.text,"Mặt Trăng là gì?");
});

test("context manager keeps a bounded history and current topic",()=>{
 const context=new ContextManager();
 const memory=new CognitiveMemory();
 memory.learn("Trái Đất","là","hành tinh","builtin-knowledge",0.99);
 const first=context.observe({input:"Trái Đất là gì?",interpreted:"Trái Đất là gì?",result:{text:"Trái Đất là hành tinh."},memory});
 assert.equal(first.currentTopic,"Trái Đất");
 for(let i=0;i<16;i++)context.observe({input:"Câu nói số "+i,interpreted:"Câu nói số "+i,result:{text:"Đã ghi nhận."},memory});
 assert.equal(context.snapshot().turnCount,12);
 assert.equal(context.snapshot().currentTopic,"Câu nói số 15");
});

test("cognitive core uses previous topic to answer a short follow-up",()=>{
 const core=new CognitiveCore(new CognitiveMemory());
 core.process("Trái Đất là gì?",null);
 const result=core.process("Nó quay quanh gì?",null);
 assert.ok(result.trace.some(step=>step.stage==="dialogue-management"&&step.usedContext));
 assert.match(result.text,/Trái Đất quay quanh Mặt Trời/);
});

test("pending question context is recorded when local evidence is missing",()=>{
 const core=new CognitiveCore(new CognitiveMemory());
 const result=core.process("Vì sao các ngôi sao phát sáng?",null);
 assert.equal(result.conversationContext.pendingQuestion.text,"Vì sao các ngôi sao phát sáng?");
 assert.ok(result.trace.some(step=>step.stage==="context-management"));
});
