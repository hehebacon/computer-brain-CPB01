import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/search-worker.js";

test("Worker rejects unapproved browser origins",async()=>{
 const request=new Request("https://search.example.workers.dev/search",{method:"POST",headers:{Origin:"https://evil.example","Content-Type":"application/json"},body:JSON.stringify({query:"public topic"})});
 const response=await worker.fetch(request,{BRAVE_SEARCH_API_KEY:"test"});
 assert.equal(response.status,403);
});

test("Worker enforces strict safe search and social domain allowlist",async()=>{
 const originalFetch=globalThis.fetch;
 let calledUrl=null,calledHeaders=null;
 globalThis.fetch=async(url,options)=>{
  calledUrl=new URL(url);calledHeaders=options.headers;
  return new Response(JSON.stringify({web:{results:[
   {title:"Public community post",url:"https://www.reddit.com/r/example/comments/1",description:"A public indexed discussion.",family_friendly:true},
   {title:"Off-domain result",url:"https://outside.example/post",description:"Not in the social allowlist.",family_friendly:true},
   {title:"Filtered result",url:"https://www.youtube.com/watch?v=1",description:"Not family friendly.",family_friendly:false}
  ]}}),{status:200,headers:{"Content-Type":"application/json"}});
 };
 try{
  const request=new Request("https://search.example.workers.dev/search",{method:"POST",headers:{Origin:"http://localhost:8000","Content-Type":"application/json"},body:JSON.stringify({query:"public topic",mode:"social",count:8})});
  const response=await worker.fetch(request,{BRAVE_SEARCH_API_KEY:"not-a-real-key"});
  const payload=await response.json();
  assert.equal(response.status,200);
  assert.equal(payload.results.length,1);
  assert.equal(payload.results[0].source,"reddit.com");
  assert.equal(calledHeaders["X-Subscription-Token"],"not-a-real-key");
  assert.equal(calledUrl.searchParams.get("safesearch"),"strict");
  assert.match(calledUrl.searchParams.get("q"),/site:reddit\.com/);
 }finally{globalThis.fetch=originalFetch;}
});

test("Worker reports missing provider credentials without exposing configuration",async()=>{
 const request=new Request("https://search.example.workers.dev/search",{method:"POST",headers:{Origin:"http://localhost:8000","Content-Type":"application/json"},body:JSON.stringify({query:"public topic"})});
 const response=await worker.fetch(request,{});
 assert.equal(response.status,503);
 const payload=await response.json();
 assert.match(payload.error,/BRAVE_SEARCH_API_KEY/);
 assert.equal(Object.hasOwn(payload,"apiKey"),false);
});
