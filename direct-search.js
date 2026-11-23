/* Direct public search: no Cloudflare Worker, API key, or model-token usage.
 * This adapter queries Wikipedia's public MediaWiki API from the browser.
 * Wider web/social indexes remain optional provider adapters.
 */
const ALLOWED_LANGUAGES=new Set(["vi","en","es","fr","de","pt","it","nl","pl","ru","ar","zh","ja","ko","hi"]);
function decodeEntities(value){
 return String(value??"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&#039;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(0x10ffff,Number(n)||0)));
}
function plainText(value){return decodeEntities(String(value??"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim());}
export class DirectSearchAdapter{
 constructor({fetchImpl=globalThis.fetch}={}){this.fetchImpl=fetchImpl;}
 async search(query,{language="vi",count=6}={}){
  const text=String(query??"").trim();
  if(!text)throw new TypeError("Search query is empty.");
  if(text.length>300)throw new RangeError("Search query is too long (max 300 characters).");
  const lang=ALLOWED_LANGUAGES.has(language)?language:"en";
  const limit=Math.max(1,Math.min(8,Number(count)||6));
  if(typeof this.fetchImpl!=="function")throw new Error("Direct network search is not supported in this environment.");
  const params=new URLSearchParams({action:"query",list:"search",srsearch:text,srlimit:String(limit),srprop:"snippet|timestamp|size",format:"json",origin:"*"});
  const endpoint="https://"+lang+".wikipedia.org/w/api.php?"+params.toString();
  const response=await this.fetchImpl(endpoint,{method:"GET",headers:{Accept:"application/json"},mode:"cors"});
  if(!response.ok)throw new Error("Wikipedia search returned HTTP "+response.status+".");
  const data=await response.json();
  const results=Array.isArray(data.query?.search)?data.query.search:[];
  return {
   query:text,language:lang,provider:"Wikipedia",mode:"direct-no-worker",fetchedAt:new Date().toISOString(),
   tokenUsage:0,workerRequests:0,
   results:results.map(item=>({
    title:String(item.title||"").slice(0,180),
    url:"https://"+lang+".wikipedia.org/wiki/"+encodeURIComponent(String(item.title||"").replace(/ /g,"_")),
    snippet:plainText(item.snippet).slice(0,600),
    source:lang+".wikipedia.org",
    updatedAt:item.timestamp||null,
    pageSize:Number(item.size)||null
   })).filter(x=>x.title&&x.url)
  };
 }
}
export function buildPublicSearchLinks(query){
 const q=String(query??"").trim();
 if(!q)throw new TypeError("Search query is empty.");
 const encoded=encodeURIComponent(q);
 return [
  {name:"Reddit public search",url:"https://www.reddit.com/search/?q="+encoded},
  {name:"YouTube public search",url:"https://www.youtube.com/results?search_query="+encoded},
  {name:"X public search",url:"https://x.com/search?q="+encoded},
  {name:"Threads public search",url:"https://www.threads.net/search?q="+encoded},
  {name:"TikTok public search",url:"https://www.tiktok.com/search?q="+encoded}
 ];
}
