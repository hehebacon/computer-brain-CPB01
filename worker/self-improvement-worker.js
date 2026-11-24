/**
 * Optional dedicated Cloudflare Worker for creating constrained update proposals.
 * Bind a narrowly scoped GitHub App installation token as GITHUB_TOKEN.
 * This endpoint only opens a branch/PR through an external broker in a future integration;
 * current version intentionally exposes health and policy validation only.
 */
import { assessChangeSet } from "../self-improvement-governance.js";
const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
export default {
 async fetch(request,env) {
  if(request.method==="GET"&&new URL(request.url).pathname==="/health")
   return reply({ok:true,service:"cpb01-self-improvement-governance",mode:"policy-only",githubTokenConfigured:Boolean(env.GITHUB_TOKEN)});
  if(request.method!=="POST")return reply({error:"Not found"},404);
  if(!env.AGENT_API_SECRET)return reply({error:"Agent API secret is not configured"},503);
  if(request.headers.get("authorization")!=="Bearer "+env.AGENT_API_SECRET)return reply({error:"Unauthorized"},401);
  const length=Number(request.headers.get("content-length")||0);
  if(length>16000)return reply({error:"Payload too large"},413);
  let body;try{body=await request.json();}catch{return reply({error:"Invalid JSON"},400);}
  const assessment=assessChangeSet(body.paths||[]);
  return reply({assessment,action:"NO_GITHUB_WRITE",note:"GitHub write integration is intentionally disabled until a dedicated GitHub App broker and isolated CI are configured."},assessment.allowed?200:403);
 }
};
