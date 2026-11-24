import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/self-improvement-worker.js";

test("GitHub broker rejects unauthenticated proposals",async()=>{
 const response=await worker.fetch(new Request("https://agent.example/propose",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({changes:[{path:"modules/demo.js",content:"export{}"}]})}),{AGENT_API_SECRET:"secret",GITHUB_TOKEN:"token",GITHUB_REPOSITORY:"owner/repo"});
 assert.equal(response.status,401);
});

test("GitHub broker rejects protected paths before any GitHub API call",async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error("should not be called");};
 try {
  const response=await worker.fetch(new Request("https://agent.example/propose",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer secret"},body:JSON.stringify({changes:[{path:"kernel/core.js",content:"bad"}]})}),{AGENT_API_SECRET:"secret",GITHUB_TOKEN:"token",GITHUB_REPOSITORY:"owner/repo"});
  assert.equal(response.status,403);
  assert.equal(calls,0);
 } finally {globalThis.fetch=original;}
});
