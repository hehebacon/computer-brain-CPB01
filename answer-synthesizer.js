/* CPB-01 evidence-based answer assembly.
 * Extracts and ranks public snippets; it does not pretend to have read full pages.
 */
const fold=s=>String(s??"").normalize("NFC").toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");
const tokenize=s=>(fold(s).match(/[\p{L}\p{N}]{2,}/gu)||[]);
const STOP=new Set("the a an and or but for to of in on at is are was were be been being this that these those with from by as into about how what why where when who which does do did can could should would la gi la ai la cai gi la con gi la mot la nhung la cua va thi trong tren duoi voi cho tu vi sao tai sao o dau khi nao nhu the nao lam sao co phai".split(" "));
const cleanSnippet=s=>String(s??"").replace(/\s+/g," ").trim().slice(0,420);
function overlap(query,result){
 const q=[...new Set(tokenize(query).filter(t=>!STOP.has(t)))];
 const doc=new Set(tokenize([result.title,result.description,result.snippet].join(" ")));
 const matched=q.filter(t=>doc.has(t));
 return {matched,score:q.length?matched.length/q.length:0};
}
function safeUrl(raw){
 try{const u=new URL(raw);if(u.protocol!=="https:"||u.username||u.password||["localhost","127.0.0.1","::1"].includes(u.hostname))return null;return u.href;}catch{return null;}
}
export function composeSearchAnswer(question,results=[],options={}){
 const prefs=options.preferences||{},facts=Array.isArray(options.memoryFacts)?options.memoryFacts:[];
 const language=prefs.language==="en"?"en":"vi";
 const detail=prefs.detail||"balanced";
 const ranked=(Array.isArray(results)?results:[]).map(r=>{
  const url=safeUrl(r.url);
  if(!url)return null;
  const item={title:String(r.title||"Untitled source").slice(0,180),url,snippet:cleanSnippet(r.snippet||r.description),source:String(r.source||new URL(url).hostname),age:String(r.age||"")};
  const relevance=overlap(question,item);
  return {...item,relevance:relevance.score,matchedTerms:relevance.matched};
 }).filter(Boolean).sort((a,b)=>b.relevance-a.relevance).slice(0,8);
 const selected=ranked.slice(0,detail==="concise"?2:detail==="detailed"?5:3);
 const relevantFacts=facts.filter(f=>overlap(question,{title:f.subject,snippet:[f.relation,f.object].join(" ")}).score>0.2).slice(0,3);
 const evidenceCoverage=selected.length?selected.reduce((n,r)=>n+r.relevance,0)/selected.length:0;
 const shared=selected.length>1?selected.slice(0,2).map(r=>new Set(r.matchedTerms)).reduce((a,b)=>new Set([...a].filter(x=>b.has(x))),new Set()):new Set();
 let text="";
 if(!selected.length){
  text=language==="en"?"No relevant public search results were returned. Try a more specific query or check that the search Worker is configured.":"Chưa có kết quả công khai phù hợp. Ông thử cụ thể hóa câu hỏi hoặc kiểm tra cấu hình Search Worker nhé.";
 }else if(language==="en"){
  text="Provisional answer from the strongest match: "+(selected[0].snippet||"The top result has no excerpt.");
  text+="\n\nSupporting public results ("+ranked.length+" total):";
  if(shared.size)text+="\nThe first two results share query terms: "+[...shared].slice(0,6).join(", ")+". This is lexical overlap, not proof of agreement.";
  for(const r of selected.slice(1))text+="\n\n• "+r.title+": "+(r.snippet||"No excerpt was provided.");
  if(relevantFacts.length)text+="\n\nRelated local facts you previously stored (not independently verified): "+relevantFacts.map(f=>f.subject+" "+f.relation+" "+f.object).join("; ")+".";
  text+="\n\nThis is an extractive, provisional answer based on snippets, not a full-page review. Open the cited sources before relying on important details.";
 }else{
  text="Tóm tắt tạm thời từ nguồn khớp nhất: "+(selected[0].snippet||"Nguồn đầu tiên không có trích đoạn.");
  text+="\n\nCác nguồn công khai hỗ trợ ("+ranked.length+" kết quả):";
  if(shared.size)text+="\nHai nguồn đầu cùng có từ khóa: "+[...shared].slice(0,6).join(", ")+". Đây là độ trùng từ, chưa chứng minh hai nguồn đồng ý với nhau.";
  for(const r of selected.slice(1))text+="\n\n• "+r.title+": "+(r.snippet||"Nguồn không cung cấp trích đoạn.");
  if(relevantFacts.length)text+="\n\nDữ kiện cục bộ liên quan ông từng lưu (chưa xác minh độc lập): "+relevantFacts.map(f=>f.subject+" "+f.relation+" "+f.object).join("; ")+".";
  text+="\n\nĐây là câu trả lời tạm thời dạng trích xuất từ snippet, chưa phải đọc toàn bộ trang. Hãy mở nguồn để kiểm tra chi tiết quan trọng.";
 }
 if(options.userAffect?.score<=-30&&language==="vi")text="Tui sẽ trình bày từng ý rõ ràng để ông dễ kiểm tra.\n"+text;
 if(prefs.examples==="always"&&!selected.some(r=>/ví dụ|vi du|example|for instance|por ejemplo/i.test(r.snippet)))text+="\n\nChưa thấy ví dụ minh họa rõ ràng trong các trích đoạn tìm được.";
 if(detail==="concise"&&selected.length>1){
  const first=selected[0];
  text=language==="en"?"Most relevant result: "+first.title+". "+first.snippet+"\n\nThis is a search excerpt, not a verified full-page answer.":"Kết quả liên quan nhất: "+first.title+". "+first.snippet+"\n\nĐây là trích đoạn tìm kiếm, chưa phải câu trả lời đã xác minh toàn trang.";
 }
 return {
  text,
  sources:selected,
  reasoning:{method:"query-term-overlap-ranking",candidateCount:ranked.length,selectedCount:selected.length,averageLexicalCoverage:Number(evidenceCoverage.toFixed(3)),sharedQueryTerms:[...shared],localMemoryFactsUsed:relevantFacts.length,limitations:["Chỉ sử dụng tiêu đề và trích đoạn do công cụ tìm kiếm trả về.","Độ trùng từ không chứng minh tính đúng hoặc sự đồng thuận của các nguồn.","Không tự động truy cập nội dung riêng tư hoặc toàn bộ trang."]},
  searchCoverage:ranked.length>=3&&evidenceCoverage>=0.4?"moderate":"low",
  personalization:{detail,tone:prefs.tone||"casual",language,examples:prefs.examples||"when-useful"}
 };
}
