import test from "node:test";
import assert from "node:assert/strict";
import { understandInput, inputEditDistance } from "../cognition/input-understanding.js";
import { classifyUtterance } from "../cognitive-core.js";

test("recovers the demonstrated Vietnamese greeting typo without losing original input",()=>{
 const result=understandInput("xuyn chao");
 assert.equal(result.status,"corrected");
 assert.equal(result.correctedText,"xin chao");
 assert.equal(result.original,"xuyn chao");
 assert.equal(result.intentHint,"greeting");
 assert.ok(result.confidence>=0.82);
 assert.equal(classifyUtterance(result.correctedText).intent,"greeting");
});

test("recovers exaggerated repeated-letter greeting typo xuynnn chao",()=>{
 const result=understandInput("xuynnn chao");
 assert.equal(result.status,"corrected");
 assert.equal(result.correctedText,"xin chao");
 assert.equal(result.intentHint,"greeting");
 assert.equal(result.original,"xuynnn chao");
 assert.ok(result.corrections.some(item=>item.type==="repeated-letter-normalization"));
});

test("normalizes a small set of exact chat spellings",()=>{
 for(const [input,expected] of [["helo","hello"],["hii","hi"],["chaoo","chao"],["xinchao","xin chao"]]){
  const result=understandInput(input);
  assert.equal(result.status,"normalized");
  assert.equal(result.correctedText,expected);
 }
});

test("recovers one mistyped word in a known greeting, including the second word",()=>{
 const result=understandInput("xin chafo");
 assert.equal(result.status,"corrected");
 assert.equal(result.correctedText,"xin chao");
});

test("leaves already-correct greetings unchanged",()=>{
 const result=understandInput("xin chao");
 assert.equal(result.status,"unchanged");
 assert.equal(result.correctedText,"xin chao");
 assert.deepEqual(result.corrections,[]);
});

test("preserves code-like and structured input verbatim",()=>{
 for(const value of ["const x = 1;","<hello>world</hello>","{ \"hello\": true }","line one\nline two"]){
  const result=understandInput(value);
  assert.equal(result.status,"preserved");
  assert.equal(result.correctedText,value);
 }
});

test("does not guess when a typo has no supported phrase interpretation",()=>{
 const result=understandInput("xuyn xyz");
 assert.equal(result.status,"unchanged");
 assert.equal(result.correctedText,"xuyn xyz");
});

test("edit distance handles insertion, deletion and substitution",()=>{
 assert.equal(inputEditDistance("xin","xuin"),1);
 assert.equal(inputEditDistance("chao","chao"),0);
 assert.equal(inputEditDistance("xuyn","xin"),2);
});
