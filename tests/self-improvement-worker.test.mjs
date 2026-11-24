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

test("scheduled research creates a valid update run before appending audit events",async()=>{
 const statements=[];
 const db={
  prepare(sql){return {bind(...args){return {
   async first(){return null;},
   async all(){return {results:[{id:"topic-1",topic:"Cloudflare D1 documentation"}]};},
   async run(){statements.push({sql,args});return {success:true};}
  };}};}
 };
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({web:{results:[]}}),{status:200,headers:{"content-type":"application/json"}});
 let pending;
 try {
  worker.scheduled({}, {DB:db,BRAVE_SEARCH_API_KEY:"test-key"}, {waitUntil(promise){pending=promise;}});
  await pending;
 } finally {globalThis.fetch=original;}
 const runInsert=statements.find(x=>x.sql.startsWith("INSERT INTO update_runs"));
 const auditInsert=statements.find(x=>x.sql.startsWith("INSERT INTO update_events"));
 const runFinish=statements.find(x=>x.sql.startsWith("UPDATE update_runs SET status=?"));
 assert.ok(runInsert,"scheduled run should be inserted before audit");
 assert.ok(auditInsert,"scheduled research should append an audit event");
 assert.equal(auditInsert.args[0],runInsert.args[0],"audit event must reference the created run");
 assert.equal(runFinish.args[0],"COMPLETED");
});
