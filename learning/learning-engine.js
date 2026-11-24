/**
 * Bounded evidence-based learning. Stores claims and provenance; never executes source content.
 */
export const EVIDENCE_STATES = Object.freeze(["UNVERIFIED","SUPPORTED","CORROBORATED","CONFLICTED","REJECTED"]);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const normalize=s=>String(s??"").normalize("NFKC").replace(/\s+/g," ").trim();
export class LearningEngine {
  constructor({maxItems=5000,clock=()=>Date.now()}={}) {
    this.maxItems=maxItems; this.clock=clock; this.items=new Map(); this.sources=new Map();
  }
  addSource(source) {
    const url=String(source?.url??"");
    let parsed;
    try { parsed=new URL(url); } catch { throw new TypeError("Source URL must be valid"); }
    if(parsed.protocol!=="https:" || parsed.username || parsed.password) throw new Error("Only public HTTPS sources are accepted");
    const id=normalize(source.id)||url;
    const record=Object.freeze({
      id,url:parsed.href,title:normalize(source.title).slice(0,240),
      publisher:normalize(source.publisher).slice(0,160),
      publishedAt:source.publishedAt||null, retrievedAt:new Date(this.clock()).toISOString(),
      authority:clamp(Number(source.authority)||0.3,0,1),
      family:normalize(source.family)||parsed.hostname
    });
    this.sources.set(id,record); return record;
  }
  learn({id,claim,kind="claim",sourceId=null,confidence=0.3,independentGroup=null}) {
    const text=normalize(claim);
    if(!text || text.length>4000) throw new TypeError("Claim must contain 1–4000 characters");
    if(!["fact","opinion","experience","hypothesis","claim"].includes(kind)) throw new TypeError("Unsupported knowledge kind");
    if(sourceId && !this.sources.has(sourceId)) throw new Error("Unknown sourceId; provenance is required");
    const key=normalize(id)||`claim-${this.clock()}-${this.items.size}`;
    const previous=this.items.get(key);
    const evidence=[...(previous?.evidence||[])];
    if(sourceId && !evidence.some(e=>e.sourceId===sourceId)) {
      const source=this.sources.get(sourceId);
      evidence.push({sourceId,authority:source.authority,family:source.family,independentGroup:independentGroup||source.family});
    }
    const families=new Set(evidence.map(e=>e.independentGroup||e.family));
    const state=evidence.length===0?"UNVERIFIED":families.size>=2?"CORROBORATED":"SUPPORTED";
    const item=Object.freeze({
      id:key,claim:text,kind,confidence:clamp(Number(confidence)||0,0,1),
      state,evidence,createdAt:previous?.createdAt||new Date(this.clock()).toISOString(),
      updatedAt:new Date(this.clock()).toISOString()
    });
    this.items.set(key,item);
    while(this.items.size>this.maxItems) this.items.delete(this.items.keys().next().value);
    return item;
  }
  markConflict(id,reason="Conflicting evidence") {
    const item=this.items.get(id); if(!item) throw new Error("Unknown knowledge item");
    const next=Object.freeze({...item,state:"CONFLICTED",conflict:normalize(reason).slice(0,500),updatedAt:new Date(this.clock()).toISOString()});
    this.items.set(id,next); return next;
  }
  get(id){return this.items.get(id)||null;}
  search(query,limit=10) {
    const terms=normalize(query).toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter(x=>x.length>1);
    return [...this.items.values()].map(item=>{
      const text=item.claim.toLocaleLowerCase();
      const score=terms.reduce((n,t)=>n+(text.includes(t)?1:0),0);
      return {item,score};
    }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,Math.max(1,Math.min(50,limit))).map(x=>x.item);
  }
  export(){return {schema:"cpb01.learning/1",sources:[...this.sources.values()],items:[...this.items.values()]};}
  import(data) {
    if(data?.schema!=="cpb01.learning/1"||!Array.isArray(data.sources)||!Array.isArray(data.items)) throw new TypeError("Invalid learning export");
    for(const source of data.sources)this.addSource(source);
    for(const item of data.items){
      if(!EVIDENCE_STATES.includes(item.state)) throw new Error("Invalid evidence state");
      this.items.set(item.id,Object.freeze({...item,evidence:[...(item.evidence||[])]}));
    }
    return this.items.size;
  }
}
