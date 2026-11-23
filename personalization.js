/* CPB-01 Personalization Profile
 * Stores only explicit presentation preferences; no sensitive-trait inference.
 */
const norm=s=>String(s??"").normalize("NFC").toLocaleLowerCase().trim();
const fold=s=>norm(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");
const allowed={detail:new Set(["concise","balanced","detailed"]),tone:new Set(["casual","neutral","formal"]),examples:new Set(["none","when-useful","always"]),language:new Set(["auto","vi","en"])};
export class PersonalizationModel{
 constructor(data={}){
  this.preferences={
   detail:allowed.detail.has(data.preferences?.detail)?data.preferences.detail:"balanced",
   tone:allowed.tone.has(data.preferences?.tone)?data.preferences.tone:"casual",
   examples:allowed.examples.has(data.preferences?.examples)?data.preferences.examples:"when-useful",
   language:allowed.language.has(data.preferences?.language)?data.preferences.language:"auto"
  };
  this.updatedAt=data.updatedAt||null;
  this.source=data.source||"default";
 }
 setPreferences(next={}){
  const changes={};
  for(const key of Object.keys(allowed)){
   if(allowed[key].has(next[key])&&this.preferences[key]!==next[key]){
    this.preferences[key]=next[key];changes[key]=next[key];
   }
  }
  if(Object.keys(changes).length){this.updatedAt=Date.now();this.source="explicit-user-setting";}
  return {changed:Object.keys(changes).length>0,changes,profile:this.snapshot()};
 }
 observe(input){
  const q=fold(input),next={};
  if(/(?:tra loi|phan hoi|giai thich).{0,24}(?:ngan gon|ngan thoi|concise|brief)|(?:ngan gon|short answers|keep it short|be concise)/.test(q))next.detail="concise";
  else if(/(?:tra loi|phan hoi|giai thich).{0,24}(?:chi tiet|day du|detailed|in depth)|(?:chi tiet hon|more detail|explain in detail)/.test(q))next.detail="detailed";
  if(/(?:noi chuyen|tra loi|xung ho).{0,20}(?:trang trong|lich su|formal)|(?:be formal|formal tone)/.test(q))next.tone="formal";
  else if(/(?:than mat|tu nhien|thoai mai|casual|friendly)/.test(q))next.tone="casual";
  if(/(?:them vi du|co vi du|include examples|more examples)/.test(q))next.examples="always";
  else if(/(?:khong can vi du|no examples|without examples)/.test(q))next.examples="none";
  if(/(?:tra loi|reply|respond).{0,20}(?:bang tieng anh|in english)/.test(q))next.language="en";
  else if(/(?:tra loi|reply|respond).{0,20}(?:bang tieng viet|in vietnamese)/.test(q))next.language="vi";
  return this.setPreferences(next);
 }
 adaptText(text,context={}){
  let output=String(text??"");
  if(this.preferences.tone==="formal")output=output.replace(/\bTui\b/g,"Tôi").replace(/\bông\b/g,"bạn");
  else if(this.preferences.tone==="casual")output=output.replace(/\bTôi\b/g,"Tui");
  if(context.mode==="supportive"&&Number(context.confidence)<0.65)output="Tui sẽ trình bày từng bước, không kết luận vội nhé.\n"+output;
  else if(context.mode==="clarifying"&&Number(context.confidence)<0.6)output+="\nÔng có thể nói rõ đối tượng hoặc phạm vi câu hỏi để tui trả lời chính xác hơn.";
  return output;
 }
 snapshot(){return {preferences:{...this.preferences},updatedAt:this.updatedAt,source:this.source,meaning:"Các lựa chọn trình bày do người dùng cung cấp; không phải hồ sơ tâm lý hay suy đoán thuộc tính nhạy cảm."};}
 export(){return {preferences:{...this.preferences},updatedAt:this.updatedAt,source:this.source};}
}
