/**
 * CPB-01 GitHub proposal broker.
 *
 * Configure GITHUB_TOKEN as a GitHub App installation token with ONLY:
 *   Contents: read/write; Pull requests: read/write; Metadata: read.
 * Do not grant Actions, Administration, Secrets, or workflow permissions.
 * The broker enforces a second path allowlist and creates draft PRs only.
 */
const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const ALLOWED=["modules/","experiments/","learning-data/"];
const BLOCKED=["kernel/","recovery/","worker/","learning/","migrations/",".github/","wrangler.toml","build.sh","package.json","index.html","brain.js","self-improvement-governance.js"];
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const safePath=path=>{
 if(typeof path!=="string"||!path.trim())return false;
 const p=path.replaceAll("\\","/");
 if(p.startsWith("/")||p.split("/").some(x=>x===".."||x==="."))return false;
 if(BLOCKED.some(x=>p===x||p.startsWith(x)))return false;
 return ALLOWED.some(x=>p.startsWith(x));
};
async function github(env,path,options={}) {
 const response=await fetch("https://api.github.com"+path,{
  ...options,
  headers:{
   "authorization":"Bearer "+env.GITHUB_TOKEN,
   "accept":"application/vnd.github+json",
   "x-github-api-version":"2022-11-28",
   "content-type":"application/json",
   ...(options.headers||{})
  }
 });
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error("GitHub API "+response.status+": "+String(body.message||"request failed").slice(0,180));
 return body;
}
export default {
async function writeAudit(db,event,data) {
 const previous=await db.prepare("SELECT event_hash,sequence FROM update_events ORDER BY sequence DESC LIMIT 1").first();
 const body={sequence:(previous?.sequence||0)+1,event,at:new Date().toISOString(),data,previousHash:previous?.event_hash||"0".repeat(64)};
 const bytes=new TextEncoder().encode(JSON.stringify(body));
 const digest=await crypto.subtle.digest("SHA-256",bytes);
 const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
 await db.prepare("INSERT INTO update_events(run_id,event,event_at,payload_json,previous_hash,event_hash) VALUES(?,?,?,?,?,?)")
  .bind("scheduled-learning",event,body.at,JSON.stringify(data),body.previousHash,hash).run();
}
 async scheduled(controller,env,ctx) {
  ctx.waitUntil((async()=>{
   if(!env.DB||!env.BRAVE_SEARCH_API_KEY)throw new Error("D1 and BRAVE_SEARCH_API_KEY are required for scheduled research");
   const topics=await env.DB.prepare("SELECT id,topic FROM research_topics WHERE enabled=1 ORDER BY last_run_at IS NOT NULL, last_run_at LIMIT 3").all();
   for(const row of topics.results||[]) {
    const started=new Date().toISOString();
    try {
     const params=new URLSearchParams({q:row.topic,count:"5",safesearch:"strict",country:"VN",search_lang:"vi"});
     const response=await fetch("https://api.search.brave.com/res/v1/web/search?"+params,{headers:{"X-Subscription-Token":env.BRAVE_SEARCH_API_KEY,"Accept":"application/json"}});
     if(!response.ok)throw new Error("Search provider HTTP "+response.status);
     const payload=await response.json();
     const results=(payload.web?.results||[]).slice(0,5);
     for(const result of results) {
      let url;try{url=new URL(result.url);}catch{continue;}
      if(url.protocol!=="https:"||url.username||url.password)continue;
      const sourceId=url.href;
      const family=url.hostname.toLowerCase();
      await env.DB.prepare("INSERT INTO knowledge_sources(id,url,title,publisher,authority,family,retrieved_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,publisher=excluded.publisher,retrieved_at=excluded.retrieved_at")
       .bind(sourceId,sourceId,String(result.title||"").slice(0,240),family,0.25,family,started).run();
      const claim=String(result.description||"").replace(/\\s+/g," ").trim().slice(0,1500);
      if(!claim)continue;
      const itemId=sourceId;
      await env.DB.prepare("INSERT INTO knowledge_items(id,claim,kind,confidence,evidence_state,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET claim=excluded.claim,updated_at=excluded.updated_at")
       .bind(itemId,claim,"claim",0.25,"UNVERIFIED",started,started).run();
      await env.DB.prepare("INSERT OR IGNORE INTO knowledge_evidence(item_id,source_id,independent_group) VALUES(?,?,?)")
       .bind(itemId,sourceId,family).run();
     }
     await env.DB.prepare("UPDATE research_topics SET last_run_at=?,last_status='ok' WHERE id=?").bind(new Date().toISOString(),row.id).run();
     await writeAudit(env.DB,"scheduled-research-completed",{topicId:row.id,resultCount:results.length});
    } catch(error) {
     await env.DB.prepare("UPDATE research_topics SET last_run_at=?,last_status=? WHERE id=?").bind(new Date().toISOString(),String(error?.message||error).slice(0,240),row.id).run();
     await writeAudit(env.DB,"scheduled-research-failed",{topicId:row.id,error:String(error?.message||error).slice(0,240)});
    }
   }
  })());
 }

 async fetch(request,env) {
  const url=new URL(request.url);
  if(request.method==="GET"&&url.pathname==="/health")
   return reply({ok:true,service:"cpb01-github-proposal-broker",mode:"draft-pr-only",repositoryConfigured:Boolean(env.GITHUB_REPOSITORY),githubTokenConfigured:Boolean(env.GITHUB_TOKEN)});
  if(request.method!=="POST"||url.pathname!=="/propose")return reply({error:"Not found"},404);
  if(!env.AGENT_API_SECRET||!env.GITHUB_TOKEN||!env.GITHUB_REPOSITORY)
   return reply({error:"Broker secrets or repository binding are not configured"},503);
  if(request.headers.get("authorization")!=="Bearer "+env.AGENT_API_SECRET)
   return reply({error:"Unauthorized"},401);
  const length=Number(request.headers.get("content-length")||0);
  if(length>180000)return reply({error:"Payload too large"},413);
  let body;try{body=await request.json();}catch{return reply({error:"Invalid JSON"},400);}
  const changes=body.changes;
  if(!Array.isArray(changes)||changes.length<1||changes.length>12)
   return reply({error:"Provide 1–12 text file changes"},400);
  if(changes.some(x=>!safePath(x?.path)))
   return reply({error:"One or more paths are outside the agent allowlist",allowedPrefixes:ALLOWED},403);
  if(changes.some(x=>typeof x.content!=="string"||x.content.length>24000))
   return reply({error:"Each file must contain at most 24 KB of UTF-8 text"},413);
  const [owner,repo]=String(env.GITHUB_REPOSITORY).split("/");
  if(!owner||!repo||String(env.GITHUB_REPOSITORY).split("/").length!==2)
   return reply({error:"GITHUB_REPOSITORY must be owner/name"},500);
  const base="main";
  const branch="cpb-agent/"+crypto.randomUUID().replaceAll("-","").slice(0,16);
  try {
   const ref=await github(env,`/repos/${owner}/${repo}/git/ref/heads/${base}`);
   const parentSha=ref.object.sha;
   const parent=await github(env,`/repos/${owner}/${repo}/git/commits/${parentSha}`);
   const blobs=[];
   for(const change of changes){
    const blob=await github(env,`/repos/${owner}/${repo}/git/blobs`,{method:"POST",body:JSON.stringify({content:change.content,encoding:"utf-8"})});
    blobs.push({path:change.path,mode:"100644",type:"blob",sha:blob.sha});
   }
   const tree=await github(env,`/repos/${owner}/${repo}/git/trees`,{method:"POST",body:JSON.stringify({base_tree:parent.tree.sha,tree:blobs})});
   const commit=await github(env,`/repos/${owner}/${repo}/git/commits`,{method:"POST",body:JSON.stringify({message:String(body.title||"CPB-01 proposed module update").slice(0,120),tree:tree.sha,parents:[parentSha]})});
   await github(env,`/repos/${owner}/${repo}/git/refs`,{method:"POST",body:JSON.stringify({ref:"refs/heads/"+branch,sha:commit.sha})});
   const pr=await github(env,`/repos/${owner}/${repo}/pulls`,{method:"POST",body:JSON.stringify({
    title:String(body.title||"CPB-01 proposed update").slice(0,200),
    body:String(body.body||"Automated CPB-01 proposal. Review CI results and audit log before merging.").slice(0,5000),
    head:branch,base,draft:true
   })});
   return reply({ok:true,branch,commit:commit.sha,pullRequest:{number:pr.number,url:pr.html_url,draft:pr.draft},changedPaths:changes.map(x=>x.path),automaticMerge:false});
  } catch(error) {
   return reply({error:"Proposal creation failed",detail:String(error?.message||error).slice(0,300),branch},502);
  }
 }
};
