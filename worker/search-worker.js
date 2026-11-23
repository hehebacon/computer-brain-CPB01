const SOCIAL_SITES=["reddit.com","youtube.com","x.com","threads.net","tiktok.com"];
const JSON_HEADERS={"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
function reply(body,status=200,headers={}){
 return new Response(JSON.stringify(body),{status,headers:{...JSON_HEADERS,...headers}});
}
function allowedOrigin(origin,env){
 if(!origin)return false;
 const allowed=String(env.ALLOWED_ORIGINS||"").split(",").map(x=>x.trim()).filter(Boolean);
 if(allowed.includes(origin))return true;
 if(["http://localhost:8000","http://127.0.0.1:8000","http://localhost:8788","http://127.0.0.1:8788"].includes(origin))return true;
 try{
  const host=new URL(origin).hostname;
  return allowed.includes("*.pages.dev")&&host.endsWith(".pages.dev");
 }catch{return false;}
}
function cors(origin){
 return {
  "access-control-allow-origin":origin,
  "access-control-allow-methods":"GET, POST, OPTIONS",
  "access-control-allow-headers":"Content-Type",
  "access-control-max-age":"86400",
  "vary":"Origin"
 };
}
function cleanResult(item){
 const raw=item.url||item.profile?.long_name||"";
 let url;
 try{url=new URL(raw);if(url.protocol!=="https:")return null;}catch{return null;}
 const host=url.hostname.replace(/^www\./,"");
 return {
  title:String(item.title||"Untitled result").slice(0,180),
  url:url.href,
  snippet:String(item.description||item.snippet||"").replace(/\s+/g," ").slice(0,500),
  source:host,
  age:String(item.age||""),
  language:String(item.language||"und"),
  familyFriendly:item.family_friendly!==false
 };
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  const origin=request.headers.get("Origin")||"";
  if(request.method==="OPTIONS"){
   if(!allowedOrigin(origin,env))return reply({error:"Origin is not allowed."},403);
   return new Response(null,{status:204,headers:cors(origin)});
  }
  if(!allowedOrigin(origin,env))return reply({error:"Origin is not allowed. Configure ALLOWED_ORIGINS for your Pages site."},403);
  if(url.pathname==="/health"&&request.method==="GET"){
   return reply({ok:true,provider:env.BRAVE_SEARCH_API_KEY?"configured":"missing-api-key",modes:["web","social-public"]},200,cors(origin));
  }
  if(url.pathname!=="/search"||request.method!=="POST")return reply({error:"Not found."},404,cors(origin));
  if(!env.BRAVE_SEARCH_API_KEY)return reply({error:"Search provider is not configured. Set BRAVE_SEARCH_API_KEY as a Worker secret."},503,cors(origin));
  const length=Number(request.headers.get("content-length")||0);
  if(length>12000)return reply({error:"Request body is too large."},413,cors(origin));
  let rawBody,body;
  try{rawBody=await request.text();if(rawBody.length>12000)return reply({error:"Request body is too large."},413,cors(origin));body=JSON.parse(rawBody);}catch{return reply({error:"Request body must be valid JSON."},400,cors(origin));}
  if(env.SEARCH_RATE_LIMITER){
   const key=request.headers.get("CF-Connecting-IP")||"anonymous";
   const limit=await env.SEARCH_RATE_LIMITER.limit({key});
   if(!limit.success)return reply({error:"Search rate limit reached. Please retry later."},429,cors(origin));
  }
  const query=String(body.query||"").trim();
  const mode=body.mode==="social"?"social":"web";
  const count=Math.max(1,Math.min(8,Number(body.count)||6));
  if(!query)return reply({error:"Query is required."},400,cors(origin));
  if(query.length>400)return reply({error:"Query is too long (max 400 characters)."},400,cors(origin));
  const language=/^[a-z]{2,3}$/.test(String(body.language||""))?String(body.language):"vi";
  const country=/^[A-Z]{2}$/.test(String(body.country||""))?String(body.country):"VN";
  const safeQuery=mode==="social"?"("+query+") ("+SOCIAL_SITES.map(x=>"site:"+x).join(" OR ")+")":query;
  const params=new URLSearchParams({q:safeQuery,count:String(count),safesearch:"strict",country,search_lang:language});
  let upstream;
  try{
   upstream=await fetch("https://api.search.brave.com/res/v1/web/search?"+params.toString(),{
    method:"GET",
    headers:{"X-Subscription-Token":env.BRAVE_SEARCH_API_KEY,"Accept":"application/json"}
   });
  }catch{return reply({error:"Could not reach the configured search provider."},502,cors(origin));}
  if(!upstream.ok){
   const providerError=await upstream.text().catch(()=>"");
   return reply({error:"Search provider returned HTTP "+upstream.status+".",providerDetail:providerError.slice(0,240)},502,cors(origin));
  }
  let data;
  try{data=await upstream.json();}catch{return reply({error:"Search provider response was not valid JSON."},502,cors(origin));}
  const raw=Array.isArray(data.web?.results)?data.web.results:[];
  const results=raw.map(cleanResult).filter(Boolean).filter(x=>x.familyFriendly).slice(0,count);
  return reply({
   query,
   mode,
   provider:"Brave Search",
   fetchedAt:new Date().toISOString(),
   publicOnly:true,
   results
  },200,cors(origin));
 }
};
