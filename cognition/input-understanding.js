/* CPB-01 Input Understanding v0.1
 * Conservative typo recovery for short conversational input.
 * Original text is never overwritten; corrections are hypotheses, not translations.
 */
const fold=value=>String(value??"").normalize("NFC").toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").trim();
function editDistance(a,b){
 const prev=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  let diagonal=prev[0];prev[0]=i;
  for(let j=1;j<=b.length;j++){
   const above=prev[j];
   prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+(a[i-1]===b[j-1]?0:1));
   diagonal=above;
  }
 }
 return prev[b.length];
}
const PHRASES=[
 {tokens:["xin","chao"],intent:"greeting",confidence:0.9},
 {tokens:["chao"],intent:"greeting",confidence:0.92},
 {tokens:["hello"],intent:"greeting",confidence:0.96},
 {tokens:["hi"],intent:"greeting",confidence:0.96},
 {tokens:["hey"],intent:"greeting",confidence:0.96}
];
function tokenCorrection(inputTokens,phrase){
 if(inputTokens.length!==phrase.tokens.length)return null;
 const corrections=[];let cost=0;
 for(let i=0;i<inputTokens.length;i++){
  const actual=inputTokens[i],expected=phrase.tokens[i];
  if(actual===expected)continue;
  // Only recover a typo in the first token of a known short greeting.
  if(i!==0||actual.length<3||expected.length<3)return null;
  const distance=editDistance(actual,expected);
  if(distance>2||distance/Math.max(actual.length,expected.length)>0.5)return null;
  corrections.push({from:actual,to:expected,distance});cost+=distance;
 }
 if(!corrections.length)return null;
 return {corrections,confidence:Math.max(0.82,phrase.confidence-cost*0.025)};
}
export function understandInput(raw,representation=null){
 const original=String(raw??"");
 const trimmed=original.trim();
 const base={original,normalizedText:trimmed,correctedText:trimmed,corrections:[],confidence:trimmed?0.99:1,status:trimmed?"unchanged":"empty",reason:"No safe correction was needed.",format:representation?.format||"plain-text"};
 if(!trimmed)return base;
 // Do not rewrite code, markup, structured data, or multiline content.
 if(base.format!=="plain-text"||/[\n\r{}<>;]/.test(trimmed)||/\b(function|const|let|var|class|import|export)\b/.test(trimmed)){
  return {...base,status:"preserved",reason:"Structured or code-like input is preserved verbatim."};
 }
 const tokens=fold(trimmed).split(/\s+/);
 const candidates=PHRASES.map(phrase=>({phrase,result:tokenCorrection(tokens,phrase)})).filter(item=>item.result);
 if(candidates.length!==1)return {...base,status:candidates.length>1?"ambiguous":"unchanged",reason:candidates.length>1?"More than one interpretation is plausible.":"No high-confidence conversational correction was found."};
 const {phrase,result}=candidates[0];
 const correctedText=phrase.tokens.join(" ");
 return {...base,correctedText,corrections:result.corrections,confidence:result.confidence,status:"corrected",reason:"Unique match to a supported conversational phrase.",intentHint:phrase.intent};
}
export { editDistance as inputEditDistance };
