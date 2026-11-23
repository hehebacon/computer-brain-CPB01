import test from "node:test";
import assert from "node:assert/strict";
import { CognitiveCore, CognitiveMemory } from "../cognitive-core.js";

test("cognitive cycle stores and recalls user-provided facts",()=>{
 const core=new CognitiveCore(new CognitiveMemory());
 const learned=core.process("Ghi nhớ: Trái Đất | là | hành tinh",null);
 assert.match(learned.text,/đã lưu/i);
 const answer=core.process("Sao Hỏa là gì?",null);
 assert.match(answer.text,/Trái Đất là hành tinh/);
 assert.equal(answer.trace.some(x=>x.stage==="memory-retrieval"),true);
});

test("can derive a cautious two-link relation",()=>{
 const memory=new CognitiveMemory();
 memory.learn("Sao Hỏa","là","hành tinh","test",0.9);
 memory.learn("hành tinh","thuộc nhóm","thiên thể","test",0.8);
 const result=new CognitiveCore(memory).process("Trái Đất là gì?",null);
 assert.match(result.text,/thiên thể/);
 assert.match(result.text,/suy luận/);
 assert.ok(result.confidence<0.8);
});

test("arithmetic parser handles precedence, parentheses and powers",()=>{
 const core=new CognitiveCore();
 assert.match(core.process("tính 2 + 3 * 4",null).text,/14/);
 assert.match(core.process("tính (2 + 3) * 4",null).text,/20/);
 assert.match(core.process("tính 2 ^ 3",null).text,/8/);
});

test("arithmetic parser rejects division by zero and non-math syntax",()=>{
 const core=new CognitiveCore();
 assert.match(core.process("tính 9 / 0",null).text,/chia cho 0/);
 assert.match(core.process("tính 2 + abc",null).text,/chưa tính được/);
});

test("working state tracks conversational turns without claiming feelings",()=>{
 const core=new CognitiveCore();
 core.process("Tôi đang lo lắng",null);
 assert.equal(core.state.turn,1);
 assert.equal(core.state.affect.label,"negative-tone");
 assert.equal(core.memory.episodes.length,0);
});

test("recognizes an unaccented definition question before fact extraction",()=>{
 const memory=new CognitiveMemory();
 const core=new CognitiveCore(memory);
 const result=core.process("trai dat la gi",null);
 assert.match(result.text,/Trái Đất là hành tinh/);
 assert.equal(result.trace.find(x=>x.stage==="intent-classification").intent,"question-definition");
 assert.equal(memory.semantic.some(f=>/la gi/i.test(f.object)),false);
});

test("stores a statement but does not store a question as a fact",()=>{
 const memory=new CognitiveMemory();
 const core=new CognitiveCore(memory);
 const before=memory.semantic.length;
 const result=core.process("Sao Mộc là hành tinh",null);
 assert.match(result.text,/ghi nhận dữ kiện/i);
 assert.equal(memory.semantic.some(f=>f.subject==="Sao Mộc"&&f.object==="hành tinh"),true);
 const question=core.process("Sao Mộc là gì?",null);
 assert.equal(question.trace.find(x=>x.stage==="intent-classification").intent,"question-definition");
 assert.equal(memory.semantic.length,before+1);
});
