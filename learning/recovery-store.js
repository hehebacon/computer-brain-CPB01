/** Recovery snapshots live in a separately bound R2 bucket, never in the agent-writable GitHub paths. */
async function digest(text){
 const result=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
 return [...new Uint8Array(result)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
export async function createRecoverySnapshot(bucket,{version,commit,files,createdAt=new Date().toISOString()}){
 if(!bucket||typeof bucket.put!=="function")throw new TypeError("Protected R2 bucket binding required");
 if(!version||!commit||!Array.isArray(files)||!files.length)throw new TypeError("version, commit and files are required");
 const clean=files.map(file=>{
  if(typeof file.path!=="string"||typeof file.content!=="string")throw new TypeError("Snapshot files must be text path/content pairs");
  if(file.path.startsWith("/")||file.path.split("/").some(x=>x===".."||x==="."))throw new Error("Unsafe snapshot path");
  return {path:file.path,content:file.content};
 }).sort((a,b)=>a.path.localeCompare(b.path));
 const payload={schema:"cpb01.recovery-snapshot/1",version,commit,createdAt,files:clean};
 const serialized=JSON.stringify(payload);
 const hash=await digest(serialized);
 const key="snapshots/"+encodeURIComponent(version)+"/"+commit+".json";
 await bucket.put(key,serialized,{httpMetadata:{contentType:"application/json"},customMetadata:{sha256:hash,version,commit}});
 return Object.freeze({key,hash,version,commit,fileCount:clean.length,createdAt});
}
export async function readRecoverySnapshot(bucket,{key,expectedHash}){
 if(!bucket||typeof bucket.get!=="function")throw new TypeError("Protected R2 bucket binding required");
 const object=await bucket.get(key);
 if(!object)throw new Error("Recovery snapshot not found");
 const serialized=await object.text();
 const actual=await digest(serialized);
 const metadata=object.customMetadata||{};
 if(actual!==expectedHash||metadata.sha256!==actual)throw new Error("Recovery snapshot integrity check failed");
 const payload=JSON.parse(serialized);
 if(payload.schema!=="cpb01.recovery-snapshot/1")throw new Error("Unsupported recovery snapshot schema");
 return payload;
}
