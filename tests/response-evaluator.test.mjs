import test from "node:test";
import assert from "node:assert/strict";
import { analyzeText } from "../input-engine.js";
import { understandInput } from "../cognition/input-understanding.js";
import { evaluateResponse } from "../cognition/response-evaluator.js";

test("evaluator selects a grounded greeting for the demonstrated typo",()=>{
 const raw="xuynnnnn chao";
 const representation=analyzeText(raw);
 const understanding=understandInput(raw,representation);
 const result={text:"Tui chưa hiểu rõ ý ông.",confidence:0.15,trace:[
  {stage:"intent-classification",intent:"statement-or-chat",confidence:0.55}
 ]};
 const evaluated=evaluateResponse({input:raw,understanding,result});
 assert.equal(understanding.correctedText,"xin chao");
 assert.equal(evaluated.selectedId,"recognized-greeting");
 assert.match(evaluated.text,/Chào ông/);
 assert.ok(evaluated.confidence>=0.8);
});

test("evaluator preserves a high-confidence grounded kernel answer",()=>{
 const result={text:"Trái Đất quay quanh Mặt Trời.",confidence:0.95,trace:[
  {stage:"intent-classification",intent:"question",confidence:0.95},
  {stage:"memory-retrieval",matches:1}
 ]};
 const evaluated=evaluateResponse({input:"Trái Đất quay quanh gì?",result});
 assert.equal(evaluated.selectedId,"kernel-answer");
 assert.equal(evaluated.text,result.text);
});

test("evaluator asks for clarification when no candidate is reliable",()=>{
 const result={text:"Tui chưa hiểu rõ ý ông.",confidence:0.1,trace:[
  {stage:"intent-classification",intent:"statement-or-chat",confidence:0.3}
 ]};
 const evaluated=evaluateResponse({input:"???",result});
 assert.equal(evaluated.selectedId,"clarification");
 assert.equal(evaluated.accepted,true);
});

test("evaluator exposes candidate scores and selected reason",()=>{
 const evaluated=evaluateResponse({input:"hello",understanding:{intentHint:"greeting",confidence:0.94},result:{text:"Chào.",confidence:0.99,trace:[]}});
 assert.ok(evaluated.candidates.length>=2);
 assert.ok(evaluated.candidates.every(item=>item.score>=0&&item.score<=1));
 assert.ok(evaluated.reason.length>0);
});
