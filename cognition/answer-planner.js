/* CPB-01 Answer Planner v0.1
 * Plans grounded answers from local memory and explicitly requests external evidence
 * when local knowledge is insufficient. It does not fabricate missing facts.
 */
const normalize=value=>String(value??"").normalize("NFC").toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");
const STOP=new Set(("la gi la cai gi la ai la sao tai sao vi sao nhu the nao the nao lam sao bao nhieu o dau khi nao co the ban tui minh toi cua va la thi mot nhung cac cho voi ve duoc").split(/\s+/));
const tokens=value=>(normalize(value).match(/[\p{L}\p{N}]+/gu)||[]).filter(token=>token.length>1&&!STOP.has(token));
function overlapScore(queryTokens,fact){
 const fields=[fact.subject,fact.relation,fact.object].map(tokens);
 const subjectHits=queryTokens.filter(token=>fields[0].includes(token)).length;
 const objectHits=queryTokens.filter(token=>fields[2].includes(token)).length;
 const all=new Set(fields.flat());
 const hits=queryTokens.filter(token=>all.has(token)).length;
 return hits+subjectHits*0.7+objectHits*0.5;
}
export function planAnswer({question,memory,questionProfile={}}={}){
 const query=String(question??"").trim();
 const queryTokens=tokens(query);
 const facts=Array.isArray(memory?.semantic)?memory.semantic:[];
 const ranked=facts.map(fact=>({fact,score:overlapScore(queryTokens,fact)}))
  .filter(item=>item.score>0)
  .sort((a,b)=>b.score-a.score||Number(b.fact.confidence||0)-Number(a.fact.confidence||0));
 const selected=ranked.slice(0,5).map(item=>item.fact);
 const sourceGroups=[...new Set(selected.map(f=>f.source||"unknown"))];
 const conflicts=selected.flatMap(f=>facts.filter(other=>
  normalize(other.subject)===normalize(f.subject)&&
  normalize(other.relation)===normalize(f.relation)&&
  normalize(other.object)!==normalize(f.object)
 ).map(other=>({fact:f,alternative:other})));
 const bestScore=ranked[0]?.score||0;
 const supported=selected.length>0&&bestScore>=1.5;
 const type=questionProfile.type||"general";
 const searchQuery=query.replace(/[?？]+$/,"").trim();
 return {
  goal:supported?"answer-from-local-evidence":"retrieve-external-evidence",
  questionType:type,
  searchQuery,
  evidence:selected,
  sourceGroups,
  conflicts,
  confidence:supported?Math.max(0.2,Math.min(0.85,Math.max(...selected.map(f=>Number(f.confidence)||0.4))*(conflicts.length?0.65:1))):0,
  answer:supported?selected.map(f=>f.subject+" "+f.relation+" "+f.object+".").join("\n")+
   (sourceGroups.includes("user-stated")?" Có dữ kiện do người dùng cung cấp, chưa được xác minh độc lập.":"")+
   (conflicts.length?" Có dữ kiện mâu thuẫn; cần kiểm tra nguồn trước khi kết luận.":""):
   "Chưa tìm thấy dữ kiện đủ liên quan trong bộ nhớ nội bộ. Cần tra cứu nguồn bên ngoài trước khi kết luận."
 };
}
