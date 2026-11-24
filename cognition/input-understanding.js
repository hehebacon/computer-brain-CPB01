/* CPB-01 Input Understanding v0.2
 * Conservative normalization for supported conversational phrases.
 * The original input is always retained; uncertain text is never guessed.
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

// Exact, deliberately small chat-spelling dictionary. Avoid ambiguous single-letter forms.
const ALIASES=new Map([
 ["helo","hello"],["hii","hi"],["heyy","hey"],["chaoo","chao"],
 ["xinchao","xin chao"]
]);

function matchPhrase(inputTokens,phrase){
 if(inputTokens.length!==phrase.tokens.length)return null;
 const corrections=[];let cost=0;
 for(let i=0;i<inputTokens.length;i++){
  const actual=inputTokens[i],expected=phrase.tokens[i];
  if(actual===expected)continue;
  // Correct at most one token, and only against a known short greeting phrase.
  if(corrections.length||actual.length<3||expected.length<3)return null;
  const distance=editDistance(actual,expected);
  if(distance>2||distance/Math.max(actual.length,expected.length)>0.5)return null;
  corrections.push({from:actual,to:expected,distance});cost+=distance;
 }
 return corrections.length?{corrections,confidence:Math.max(0.82,phrase.confidence-cost*0.025)}:null;
}

export function understandInput(raw,representation=null){
 const original=String(raw??"");
 const trimmed=original.trim();
 const base={original,normalizedText:trimmed,correctedText:trimmed,corrections:[],confidence:trimmed?0.99:1,status:trimmed?"unchanged":"empty",reason:"No safe correction was needed.",format:representation?.format||"plain-text"};
 if(!trimmed)return base;
 // Never rewrite code, markup, structured data, or multiline content.
 if(base.format!=="plain-text"||/[\n\r{}<>;]/.test(trimmed)||/\b(function|const|let|var|class|import|export)\b/.test(trimmed)){
  return {...base,status:"preserved",reason:"Structured or code-like input is preserved verbatim."};
 }
 const folded=fold(trimmed);
 const alias=ALIASES.get(folded);
 if(alias){
  const phrase=PHRASES.find(item=>item.tokens.join(" ")===alias||item.tokens.join("")===alias);
  return {...base,correctedText:alias,corrections:[{from:folded,to:alias,type:"known-chat-alias"}],confidence:0.94,status:"normalized",reason:"Exact match to a small, explicit chat-spelling dictionary.",...(phrase?{intentHint:phrase.intent}:{})};
 }
 // Collapse exaggerated consecutive-letter typing (e.g. "xuynnn" -> "xuyn")
 // only for matching a known conversational phrase. Keep the user's raw text intact.
 const tokens=folded.split(/\s+/);
 const matchingTokens=tokens.map(token=>token.replace(/(.)\1{2,}/g,"$1"));
 const candidates=PHRASES.map(phrase=>({phrase,result:matchPhrase(matchingTokens,phrase)})).filter(item=>item.result);
 if(candidates.length!==1)return {...base,status:candidates.length>1?"ambiguous":"unchanged",reason:candidates.length>1?"More than one interpretation is plausible.":"No high-confidence conversational correction was found."};
 const {phrase,result}=candidates[0];
 const repetitionCorrections=tokens.flatMap((token,index)=>token!==matchingTokens[index]?[{from:token,to:matchingTokens[index],type:"repeated-letter-normalization"}]:[]);
 return {...base,correctedText:phrase.tokens.join(" "),corrections:[...repetitionCorrections,...result.corrections],confidence:Math.min(result.confidence,repetitionCorrections.length?0.88:result.confidence),status:"corrected",reason:"Unique match to a supported conversational phrase after conservative typo normalization.",intentHint:phrase.intent};
}
export {editDistance as inputEditDistance};
