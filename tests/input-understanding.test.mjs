import test from "node:test";
import assert from "node:assert/strict";
import { understandInput, inputEditDistance } from "../cognition/input-understanding.js";

test("recovers the demonstrated Vietnamese greeting typo without losing original input",()=>{
 const result=understandInput("xuyn chao");
 assert.equal(result.status,"corrected");
 assert.equal(result.correctedText,"xin chao");
 assert.equal(result.original,"xuyn chao");
 assert.equal(result.intentHint,"greeting");
 assert.ok(result.confidence>=0.82);
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
 });
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
