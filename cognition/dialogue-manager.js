/* CPB-01 Dialogue Manager: resolve short follow-ups against bounded context. */
const fold=s=>String(s??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").toLocaleLowerCase("vi").trim();
const FOLLOWUP=/^(?:(?:the con|con|vay con|vay|the|no|dieu do|cai do|cua no)\b|(?:tai sao|vi sao|why|how|what about|and)\b)/i;
const HAS_PRONOUN=/(nó|điều đó|cái đó|thế đó|\bno\b|\bdieu do\b|\bcai do\b|\bthe do\b|\bthat\b|\bit\b|\bthey\b|\bthem\b|\bthis\b|\bthose\b)/i;
const PRONOUNS=/(nó|điều đó|cái đó|thế đó|\bno\b|\bdieu do\b|\bcai do\b|\bthe do\b|\bthat\b|\bit\b|\bthey\b|\bthem\b|\bthis\b|\bthose\b)/gi;
export class DialogueManager{
 resolve(input,context){
  const original=String(input??"").trim(),topic=context?.currentTopic;
  if(!topic||!original)return {text:original,usedContext:false,topic:null,reason:"no-context"};
  const normalized=fold(original);
  const isFollowup=FOLLOWUP.test(normalized)||HAS_PRONOUN.test(original)||/\b(con|vay)\s+(sao|thi|the nao)\b/i.test(normalized);
  if(!isFollowup)return {text:original,usedContext:false,topic:null,reason:"standalone-turn"};
  let text=original.replace(PRONOUNS,topic);
  if(/^(con|the con|vay con)\b/i.test(normalized)&&!fold(text).includes(fold(topic)))text=topic+" "+text;
  if(/^(tai sao|vi sao|why|how)\b/i.test(normalized)&&!fold(text).includes(fold(topic)))text=original.replace(/^(tai sao|vi sao|why|how)\b/i,m=>m+" "+topic);
  return {text,usedContext:text!==original,topic,reason:"follow-up-resolved"};
 }
 observe(input,interpreted,result,contextManager,memory){
  return contextManager.observe({input,interpreted,result,memory});
 }
}
