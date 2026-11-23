import test from "node:test";
import assert from "node:assert/strict";
import { analyzeText, analyzeFile } from "../input-engine.js";

test("detects and parses JSON",()=>{
 const r=analyzeText('{"name":"CPB-01","enabled":true}');
 assert.equal(r.format,"json");assert.equal(r.structure.rootType,"object");assert.deepEqual(r.structure.keys,["name","enabled"]);
});
test("detects Markdown structure",()=>{
 const r=analyzeText("# Title\n\nA paragraph.\n\n\x60\x60\x60js\nconst x = 1;\n\x60\x60\x60","note.md");
 assert.equal(r.format,"markdown");assert.equal(r.structure.headings,1);
});
test("detects source code",()=>{
 const r=analyzeText("function add(a, b) { return a + b; }","sample.js");assert.equal(r.format,"source-code");
});
test("preserves raw text and identifies Vietnamese heuristically",()=>{
 const source="Tôi đang thử bộ xử lý văn bản.";const r=analyzeText(source);assert.equal(r.content.raw,source);assert.match(r.language.label,/Vietnamese/);
});
test("recognizes PDF signature without claiming extraction",async()=>{
 const bytes=new Uint8Array([37,80,68,70,45,49,46,55]);const file=new Blob([bytes],{type:"application/pdf"});Object.defineProperty(file,"name",{value:"sample.pdf"});const r=await analyzeFile(file);assert.equal(r.detectedFormat,"pdf");assert.equal(r.status,"recognized-needs-adapter");
});

import { validateRepresentation, UIR_VERSION } from "../universal-representation.js";

test("returns a valid versioned UIR with loss-aware normalization",()=>{
 const raw="Xin chào\r\nThe sky is blue.";
 const u=analyzeText(raw,"note.txt");
 assert.equal(u.schema,UIR_VERSION);
 assert.equal(u.content.raw,raw);
 assert.equal(u.content.normalized,"Xin chào\nThe sky is blue.");
 assert.equal(validateRepresentation(u).valid,true);
 assert.ok(u.tokens.length>0);
 assert.ok(u.segments.length>0);
});

test("records that JSON parsing is structure analysis, not semantic understanding",()=>{
 const u=analyzeText('{"name":"CPB","items":[1,2]}',"data.json");
 assert.equal(u.format,"json");
 assert.equal(u.structure.rootType,"object");
 assert.equal(u.interpretation.status,"not-performed");
 assert.equal(validateRepresentation(u).valid,true);
});

test("keeps uncertain language detection explicit",()=>{
 const u=analyzeText("xyz qqq zzz","sample.txt");
 assert.ok(u.language.confidence<=0.5);
 assert.ok(u.limitations.length>0);
});

test("marks malformed JSON as partially understood",()=>{
 const u=analyzeText('{"x":',"bad.json");
 assert.equal(u.format,"json-invalid");
 assert.equal(u.status,"partially-understood");
 assert.equal(validateRepresentation(u).valid,true);
});
