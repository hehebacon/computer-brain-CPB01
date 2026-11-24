/** Tamper-evident hash-chained update journal. Persist returned records in D1/R2 or protected GitHub artifacts. */
const stable=value=>JSON.stringify(value,Object.keys(value||{}).sort());
async function sha256(value){
 if(!globalThis.crypto?.subtle)throw new Error("Web Crypto SHA-256 is unavailable");
 const bytes=new TextEncoder().encode(value);
 const digest=await globalThis.crypto.subtle.digest("SHA-256",bytes);
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
export class UpdateAuditLog {
 constructor({sink=async()=>{},clock=()=>new Date().toISOString()}={}){this.sink=sink;this.clock=clock;this.records=[];this.tail="0".repeat(64);}
 async append({runId,event,data={}}) {
  const body={sequence:this.records.length+1,runId:String(runId),event:String(event),at:this.clock(),data,previousHash:this.tail};
  const hash=await sha256(JSON.stringify(body));
  const record=Object.freeze({...body,hash});
  await this.sink(record);
  this.records.push(record);this.tail=hash;return record;
 }
 async verify(records=this.records) {
  let previous="0".repeat(64);
  for(let i=0;i<records.length;i++){
   const {hash,...body}=records[i];
   if(body.sequence!==i+1||body.previousHash!==previous||await sha256(JSON.stringify(body))!==hash)
    return {valid:false,atSequence:i+1,reason:"HASH_CHAIN_MISMATCH"};
   previous=hash;
  }
  return {valid:true,count:records.length,tail:previous};
 }
 export(){return {schema:"cpb01.update-audit/1",records:[...this.records],tail:this.tail};}
}
