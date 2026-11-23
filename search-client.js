/* Browser-side client for the CPB-01 public-search Worker.
 * Provider credentials stay on the Worker and are never sent to this client.
 */
export class SearchClient{
 constructor(endpoint=""){this.endpoint="";if(endpoint)this.configure(endpoint);}
 configure(endpoint){
  const value=String(endpoint||"").trim();
  if(!value){this.endpoint="";return "";}
  let url;
  try{url=new URL(value);}catch{throw new TypeError("Search Worker URL is not valid.");}
  const local=["localhost","127.0.0.1"].includes(url.hostname);
  if(url.protocol!=="https:"&&!(local&&url.protocol==="http:"))throw new TypeError("Search Worker must use HTTPS (HTTP is allowed only on localhost).");
  if(url.username||url.password)throw new TypeError("Do not put credentials in the Worker URL.");
  this.endpoint=url.href.replace(/\/+$/,"").replace(/\/search$/,"");
  return this.endpoint;
 }
 get configured(){return Boolean(this.endpoint);}
 async search(query,{mode="web",language="vi",country="VN",count=8}={}){
  const text=String(query??"").trim();
  if(!text)throw new TypeError("Search query is empty.");
  if(text.length>400)throw new RangeError("Search query is too long (max 400 characters).");
  if(!this.endpoint)throw new Error("Search Worker URL has not been configured.");
  if(!["web","social"].includes(mode))throw new TypeError("Unsupported search mode.");
  const response=await fetch(this.endpoint+"/search",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({query:text,mode,language,country,count:Math.max(1,Math.min(8,Number(count)||8))}),
   signal:typeof AbortSignal!=="undefined"&&AbortSignal.timeout?AbortSignal.timeout(18000):undefined
  });
  let payload;
  try{payload=await response.json();}catch{throw new Error("Search Worker returned an unreadable response.");}
  if(!response.ok)throw new Error(payload.error||("Search request failed ("+response.status+")."));
  if(!Array.isArray(payload.results))throw new Error("Search Worker response is missing results.");
  return payload;
 }
}
