/** Deterministic lexical association discovery with explicit, reviewable provenance. */
const tokens=s=>new Set(String(s??"").normalize("NFKC").toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[]);
export class AssociationEngine {
  constructor({minSharedTerms=2,maxPairs=100}={}){this.minSharedTerms=minSharedTerms;this.maxPairs=maxPairs;}
  discover(items=[]) {
    const rows=items.filter(x=>x&&x.id&&x.claim).slice(0,500).map(x=>({...x,_terms:tokens(x.claim)}));
    const pairs=[];
    for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
      const shared=[...rows[i]._terms].filter(t=>rows[j]._terms.has(t));
      if(shared.length<this.minSharedTerms)continue;
      pairs.push({from:rows[i].id,to:rows[j].id,sharedTerms:shared,score:shared.length/Math.max(1,new Set([...rows[i]._terms,...rows[j]._terms]).size),status:"CANDIDATE",warning:"Lexical overlap is not proof of a causal or semantic relationship."});
    }
    return pairs.sort((a,b)=>b.score-a.score).slice(0,this.maxPairs);
  }
}
