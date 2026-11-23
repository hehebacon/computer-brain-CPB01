/* CPB-01 Human Cognitive Systems (HCS) v0.2
 * Multilingual text-signal estimates and a bounded, inspectable affect meter.
 * This models software state; it does not claim subjective feelings.
 */
const norm=s=>String(s??"").normalize("NFC").toLocaleLowerCase().trim();
const fold=s=>norm(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d");
const words=s=>String(s).match(/[\p{L}\p{M}\p{N}_]+/gu)||[];
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const scripts=[
 {language:"ja",script:"Japanese",pattern:/[\u3040-\u30ff]/},
 {language:"zh",script:"Han",pattern:/[\u3400-\u9fff]/},
 {language:"ko",script:"Hangul",pattern:/[\uac00-\ud7af]/},
 {language:"ru",script:"Cyrillic",pattern:/[\u0400-\u04ff]/},
 {language:"ar",script:"Arabic",pattern:/[\u0600-\u06ff]/},
 {language:"hi",script:"Devanagari",pattern:/[\u0900-\u097f]/},
 {language:"bn",script:"Bengali",pattern:/[\u0980-\u09ff]/},
 {language:"ta",script:"Tamil",pattern:/[\u0b80-\u0bff]/},
 {language:"te",script:"Telugu",pattern:/[\u0c00-\u0c7f]/},
 {language:"el",script:"Greek",pattern:/[\u0370-\u03ff]/},
 {language:"he",script:"Hebrew",pattern:/[\u0590-\u05ff]/},
 {language:"th",script:"Thai",pattern:/[\u0e00-\u0e7f]/},
 {language:"km",script:"Khmer",pattern:/[\u1780-\u17ff]/},
 {language:"am",script:"Ethiopic",pattern:/[\u1200-\u137f]/},
 {language:"hy",script:"Armenian",pattern:/[\u0530-\u058f]/},
 {language:"ka",script:"Georgian",pattern:/[\u10a0-\u10ff]/}
];
const LANGUAGE_CUES={
 vi:["toi","tui","ban","minh","khong","nhung","duoc","la gi","cam on"],
 en:["the","you","what","why","please","thank you","hello","i am","not","happy","sad","good","bad","because","where","when","how"],
 es:["que","como","gracias","hola","porque","eres","donde","estoy","feliz","triste","muy bien","no estoy"],
 fr:["bonjour","merci","vous","pourquoi","comment","est ce","je suis","heureux","heureuse","triste","pas"],
 de:["hallo","danke","warum","bitte","nicht","was","ich bin","glücklich","traurig","gut","schlecht"],
 pt:["ola","obrigado","obrigada","voce","porque","como","eu sou","feliz","triste","nao","estou"],
 it:["ciao","grazie","perche","come","sono","felice","triste","buono","non"],
 ru:["привет","спасибо","почему","что","как"],
 ar:["مرحبا","شكرا","لماذا","كيف","ما"],
 zh:["你好","谢谢","为什么","什么","怎么"],
 ja:["こんにちは","ありがとう","なぜ","何","どう"],
 ko:["안녕하세요","감사합니다","왜","무엇","어떻게"],
 hi:["नमस्ते","धन्यवाद","क्यों","क्या","कैसे"]
};
export function detectLanguageHint(input){
 const text=norm(input);
 for(const item of scripts)if(item.pattern.test(text))return {language:item.language,script:item.script,confidence:0.82,method:"unicode-script"};
 const f=fold(text);
 let best={language:"und",score:0};
 for(const [language,cues] of Object.entries(LANGUAGE_CUES)){
  const score=cues.reduce((n,c)=>n+(f.includes(fold(c))?1:0),0);
  if(score>best.score)best={language,score};
 }
 return {language:best.score?best.language:"und",script:"Latin",confidence:best.score?clamp(0.38+best.score*0.13,0.38,0.86):0.18,method:"keyword-hint"};
}
const EMOTION_LEXICON={
 joy:["vui","hanh phuc","phan khoi","tuyet voi","qua da","thich qua","yeu doi","great","happy","glad","excited","wonderful","amazing","fantastic","feliz","alegre","genial","heureux","heureuse","super","glücklich","toll","feliz","ótimo","felice","素晴らしい","嬉しい","开心","高兴","행복","기뻐","счастлив","рад"],
 sadness:["buon","that vong","chan nan","co don","met moi","that bai","sad","upset","disappointed","lonely","not happy","not okay","not ok","khong vui","khong hanh phuc","no feliz","pas heureux","nicht glücklich","não feliz","non felice","嬉しくない","不开心","행복하지 않아","не счастлив","悲しい","伤心","难过","슬퍼","х грустно","грустно"],
 anger:["tuc","gian","buc xuc","kho chiu","uc che","phien","hate","hate this","ghét","odio","haine","hass","odeio","憎い","讨厌","싫어","ненавижу","أكره","नफरत","annoyed","angry","furious","enojado","molesto","fâché","colère","wütend","怒","生气","화나","злой","غاضب"],
 fear:["so","lo lang","hoang so","bat an","run","fear","afraid","worried","anxious","miedo","temor","peur","Angst","medo","paura","怖い","害怕","무서워","страшно"],
 surprise:["bat ngo","khong ngo","kinh ngac","wow","surprised","unexpected","sorpresa","surpris","überrascht","惊讶","びっくり","놀라","удивлен"],
 confusion:["khong hieu","roi qua","boi roi","kho hieu","confused","unclear","what do you mean","confundido","perdu","verwirrt","困惑","混乱","헷갈려"],
 gratitude:["cam on","biet on","thanks","thank you","appreciate","gracias","merci","danke","obrigado","obrigada","grazie","ありがとう","谢谢","감사합니다","спасибо","شكرا","धन्यवाद"],
 curiosity:["to mo","muon biet","tai sao","vi sao","how does","wonder","curious","curioso","curieuse","neugierig","curioso","気になる","好奇","궁금","интересно"]
};
const PRAISE=[
 "ban gioi","ban lam tot","gioi lam","rat hay","lam tot lam","cam on ban","toi tu hao ve ban","ban that tuyet","ban rat huu ich",
 "you are great","you are amazing","you are wonderful","you did great","well done","great job","brilliant work","i appreciate you",
 "eres genial","eres increible","muy bien","buen trabajo","tu es genial","bravo","c'est super","bon travail","du bist toll","gut gemacht",
 "voce e incrivel","muito bom","ottimo lavoro","素晴らしい","よくできました","你真棒","做得好","정말 잘했어","대단해","молодец","أحسنت","बहुत अच्छा"
];
const INSULTS=[
 "do ngu","ngu ngoc","vo dung","te hai","kem coi","that bai","stupid","idiot","useless","worthless","dumb","pathetic",
 "inutil","tonto","idiota","nul","imbecile","dumm","nutzlos","inútil","stupido","inutile","ばか","愚か","笨蛋","没用","바보","쓸모없어","идиот","глупый","غبي","बेवकूफ"
];
const NEGATION=["khong","chang","chua","not","never","no","nunca","jamais","nicht","ne","non","não","нет","لا","नहीं"];
function hasPhrase(text,phrase){
 const p=fold(phrase);
 if(!p)return false;
 if(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff\u0600-\u06ff\u0900-\u097f]/.test(p))return text.includes(p);
 const clean=value=>value.replace(/[^\p{L}\p{M}\p{N}]+/gu," ").replace(/\s+/g," ").trim();
 return (" "+clean(text)+" ").includes(" "+clean(p)+" ");
}
function negatedBefore(text,phrase){
 const p=fold(phrase),index=text.indexOf(p);
 if(index<0)return false;
 const before=text.slice(Math.max(0,index-28),index);
 return NEGATION.some(n=>new RegExp("(?:^|\\s)"+n+"\\s*$","u").test(before));
}
function matchedTerms(text,terms){return terms.filter(term=>hasPhrase(text,term)&&!negatedBefore(text,term));}
export function recognizeEmotion(input){
 const text=fold(input),signals=[];
 for(const [emotion,terms] of Object.entries(EMOTION_LEXICON)){
  const matched=matchedTerms(text,terms);
  if(matched.length)signals.push({emotion,signals:matched,count:matched.length});
 }
 const praise=matchedTerms(text,PRAISE),insults=matchedTerms(text,INSULTS);
 if(praise.length)signals.push({emotion:"compliment",signals:praise,count:praise.length});
 if(insults.length)signals.push({emotion:"insult",signals:insults,count:insults.length});
 const positive=signals.reduce((n,s)=>n+s.count*(["joy","gratitude","compliment","curiosity","surprise"].includes(s.emotion)?({joy:1,gratitude:0.7,compliment:1.25,curiosity:0.15,surprise:0.2}[s.emotion]):0),0);
 const negative=signals.reduce((n,s)=>n+s.count*(["sadness","anger","fear","confusion","insult"].includes(s.emotion)?({sadness:0.8,anger:1.15,fear:0.8,confusion:0.25,insult:1.35}[s.emotion]):0),0);
 const punctuation=(String(input).match(/[!?！？]{2,}/g)||[]).length;
 const total=positive+negative;
 const valence=total?clamp((positive-negative)/Math.max(1,total),-1,1):0;
 const intensity=signals.length?clamp(0.3+Math.min(0.45,signals.reduce((n,s)=>n+s.count,0)*0.1)+Math.min(0.25,punctuation*0.08)):0;
 const strongest=[...signals].sort((a,b)=>b.count-a.count)[0];
 const primary=strongest?.emotion||"undetermined";
 return {
  primary,signals,intensity,valence,praiseDetected:praise.length>0,insultDetected:insults.length>0,
  confidence:signals.length?clamp(0.42+(strongest?.count||0)*0.13,0,0.86):0.15,
  language:detectLanguageHint(input),
  method:"multilingual-lexicon-and-context-heuristic",
  caveat:"Ước lượng tín hiệu ngôn ngữ; không xác định chắc chắn cảm xúc thật, ý định hay đối tượng mà câu nói nhắm tới."
 };
}
const QUESTION_PREFIXES=[
 ["what is","definition","en"],["what are","definition","en"],["who is","person","en"],["who are","person","en"],["why","cause","en"],["where","location","en"],["when","time","en"],["how many","quantity","en"],["how much","quantity","en"],["how","method-or-process","en"],["what","definition-or-object","en"],["who","person","en"],["is","yes-no","en"],["are","yes-no","en"],["do","yes-no","en"],["does","yes-no","en"],["can","yes-no","en"],["will","yes-no","en"],
 ["la gi","definition","vi"],["la ai","person","vi"],["tai sao","cause","vi"],["vi sao","cause","vi"],["o dau","location","vi"],["khi nao","time","vi"],["bao nhieu","quantity","vi"],["the nao","method-or-process","vi"],["lam sao","method-or-process","vi"],["co phai","yes-no","vi"],["ai","person","vi"],["cai gi","definition-or-object","vi"],["gi","definition-or-object","vi"],
 ["qué es","definition","es"],["que es","definition","es"],["quién","person","es"],["quien","person","es"],["por qué","cause","es"],["por que","cause","es"],["porque","cause","es"],["dónde","location","es"],["donde","location","es"],["cuándo","time","es"],["cuando","time","es"],["cuántos","quantity","es"],["cuantos","quantity","es"],["cómo","method-or-process","es"],["como","method-or-process","es"],["qué","definition-or-object","es"],["que","definition-or-object","es"],
 ["qu'est-ce que","definition","fr"],["qui","person","fr"],["pourquoi","cause","fr"],["où","location","fr"],["ou","location","fr"],["quand","time","fr"],["combien","quantity","fr"],["comment","method-or-process","fr"],["est-ce que","yes-no","fr"],["quoi","definition-or-object","fr"],
 ["was ist","definition","de"],["wer","person","de"],["warum","cause","de"],["wo","location","de"],["wann","time","de"],["wie viele","quantity","de"],["wie viel","quantity","de"],["wie","method-or-process","de"],["was","definition-or-object","de"],["ist","yes-no","de"],
 ["o que é","definition","pt"],["o que e","definition","pt"],["quem","person","pt"],["por que","cause","pt"],["onde","location","pt"],["quando","time","pt"],["quantos","quantity","pt"],["como","method-or-process","pt"],["é","yes-no","pt"],["e","yes-no","pt"],
 ["che cos'è","definition","it"],["che cosa è","definition","it"],["chi","person","it"],["perché","cause","it"],["perche","cause","it"],["dove","location","it"],["quando","time","it"],["quanti","quantity","it"],["come","method-or-process","it"],["cosa","definition-or-object","it"],
 ["что такое","definition","ru"],["кто","person","ru"],["почему","cause","ru"],["где","location","ru"],["когда","time","ru"],["сколько","quantity","ru"],["как","method-or-process","ru"],["что","definition-or-object","ru"],
 ["لماذا","cause","ar"],["أين","location","ar"],["اين","location","ar"],["متى","time","ar"],["كيف","method-or-process","ar"],["كم","quantity","ar"],["من","person","ar"],["ما هو","definition","ar"],["ما هي","definition","ar"],["ماذا","definition-or-object","ar"],["هل","yes-no","ar"],
 ["什么是","definition","zh"],["是什么","definition","zh"],["是谁","person","zh"],["为什么","cause","zh"],["哪里","location","zh"],["哪儿","location","zh"],["什么时候","time","zh"],["多少","quantity","zh"],["怎么","method-or-process","zh"],["什么","definition-or-object","zh"],["谁","person","zh"],["吗","yes-no","zh"],
 ["とは","definition","ja"],["は何","definition","ja"],["誰","person","ja"],["なぜ","cause","ja"],["どうして","cause","ja"],["どこ","location","ja"],["いつ","time","ja"],["いくつ","quantity","ja"],["どう","method-or-process","ja"],["何","definition-or-object","ja"],["ですか","yes-no","ja"],
 ["이란","definition","ko"],["누구","person","ko"],["왜","cause","ko"],["어디","location","ko"],["언제","time","ko"],["얼마나","quantity","ko"],["어떻게","method-or-process","ko"],["무엇","definition-or-object","ko"],["뭐","definition-or-object","ko"],["인가요","yes-no","ko"],
 ["क्या है","definition","hi"],["कौन","person","hi"],["क्यों","cause","hi"],["कहाँ","location","hi"],["कब","time","hi"],["कितना","quantity","hi"],["कैसे","method-or-process","hi"],["क्या","definition-or-object","hi"]
].map(([phrase,type,language])=>[fold(phrase),type,language]).sort((a,b)=>b[0].length-a[0].length);
export function classifyQuestion(input){
 const original=String(input??"").trim(),q=fold(original).replace(/^[^\p{L}\p{M}\p{N}]+/u,""),hint=detectLanguageHint(original);
 const definition=q.match(/^(.+?)\s+(?:la gi|la ai|la cai gi|la con gi)\??$/);
 if(definition)return {isQuestion:true,type:"definition",target:original.replace(/\s+(?:là gì|la gi|là ai|la ai|là cái gì|la cai gi|là con gì|la con gi)\s*\??$/i,"").trim(),language:"vi",confidence:0.94};
 const match=QUESTION_PREFIXES.find(([prefix])=>q===prefix||q.startsWith(prefix+" ")||q.startsWith(prefix+"?")||q.startsWith(prefix+"？")||(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(prefix)&&q.startsWith(prefix)));
 const hasQuestionMark=/[?？؟]$/.test(original);
 if(!match&&!hasQuestionMark)return {isQuestion:false,type:"none",target:null,language:hint.language,confidence:0.2};
 const type=match?.[1]||"general",prefix=match?.[0]||"";
 let target=null;
 if(type==="definition"&&prefix){
  target=original.replace(/^[^\p{L}\p{M}\p{N}]+/u,"").slice(prefix.length).replace(/^[\s:：,，]+/u,"").replace(/[?？؟!！.。]+$/u,"").trim()||null;
 }
 return {isQuestion:true,type,target,language:match?.[2]||hint.language,confidence:match?0.78:0.55};
}
const ACT_PATTERNS={
 greeting:["xin chao","chao","hello","hi","hey","hola","bonjour","guten tag","ciao","olá","こんにちは","你好","안녕하세요","привет","مرحبا","नमस्ते"],
 thanks:["cam on","biet on","thanks","thank you","gracias","merci","danke","obrigado","obrigada","grazie","ありがとう","谢谢","감사합니다","спасибо","شكرا","धन्यवाद"],
 apology:["xin loi","sorry","my bad","lo siento","perdon","désolé","es tut mir","scusa","ごめんなさい","对不起","미안합니다","извини","آسف"],
 request:["hay","lam on","vui long","please","giup tui","giup toi","por favor","s'il vous plaît","bitte","per favore","お願いします","请","해주세요","пожалуйста"],
 disagreement:["khong dong y","toi khong dong y","sai roi","i disagree","no estoy de acuerdo","je ne suis pas d'accord","ich stimme nicht zu","não concordo","non sono d'accordo","反対","동의하지 않","не согласен"]
};
const ALLOWED_QUESTION_TYPES=new Set(["definition","person","cause","location","time","quantity","method-or-process","yes-no","general","definition-or-object"]);
const ALLOWED_ACTS=new Set(["greeting","thanks","apology","request","disagreement"]);
export function registerLanguagePack(pack){
 if(!pack||typeof pack!=="object")throw new TypeError("Language pack must be an object");
 const code=String(pack.code||"").toLowerCase();
 if(!/^[a-z][a-z0-9-]{1,11}$/.test(code))throw new TypeError("Language pack needs a short language code");
 const list=value=>Array.isArray(value)?value.map(x=>String(x).trim()).filter(Boolean):[];
 LANGUAGE_CUES[code]=list(pack.cues);
 for(const [emotion,terms] of Object.entries(pack.emotions||{})){
  if(!Object.hasOwn(EMOTION_LEXICON,emotion))continue;
  EMOTION_LEXICON[emotion].push(...list(terms));
 }
 PRAISE.push(...list(pack.praise));
 INSULTS.push(...list(pack.insults));
 for(const [act,terms] of Object.entries(pack.dialogueActs||{})){
  if(ALLOWED_ACTS.has(act))ACT_PATTERNS[act].push(...list(terms));
 }
 for(const item of Array.isArray(pack.questions)?pack.questions:[]){
  if(item&&ALLOWED_QUESTION_TYPES.has(item.type)&&String(item.phrase||"").trim())QUESTION_PREFIXES.push([fold(String(item.phrase)),item.type,code]);
 }
 QUESTION_PREFIXES.sort((a,b)=>b[0].length-a[0].length);
 return {language:code,cues:LANGUAGE_CUES[code].length,questionPatterns:(pack.questions||[]).length,registered:true};
}
export function classifyDialogueAct(input){
 const q=fold(input);
 for(const [act,terms] of Object.entries(ACT_PATTERNS))if(terms.some(t=>hasPhrase(q,t)))return act;
 if(classifyQuestion(input).isQuestion)return "question";
 return "statement";
}
const EMOTION_LABELS={
 positive:[{min:86,label:"Xúc động"},{min:56,label:"Phấn khởi"},{min:26,label:"Vui"},{min:9,label:"Hơi vui"}],
 negative:[{min:86,label:"Tức giận / rất căng thẳng"},{min:56,label:"Tức giận"},{min:26,label:"Buồn / thất vọng"},{min:9,label:"Chùng xuống"}]
};
function affectLabel(score,primary){
 const n=Math.abs(score);
 if(n<9)return "Bình thường";
 const list=score>0?EMOTION_LABELS.positive:EMOTION_LABELS.negative;
 const level=list.find(x=>n>=x.min)?.label||"Bình thường";
 if(score<0&&(primary==="anger"||primary==="insult")&&n>=26)return n>=56?"Tức giận":"Bực bội";
 if(score<0&&primary==="sadness"&&n>=26)return n>=56?"Buồn sâu":"Buồn";
 return level;
}
export class AffectiveState{
 constructor(data={}){
  this.score=Math.round(clamp(Number(data.score)||0,-100,100));
  this.lastEmotion=data.lastEmotion||"undetermined";
  this.lastSignal=data.lastSignal||"neutral";
  this.updatedAt=data.updatedAt||Date.now();
  this.source=data.source||"baseline";
 }
 observe(input,emotion=recognizeEmotion(input)){
  const previous=Number(this.score)||0;
  const delta=Math.round(emotion.valence*(10+emotion.intensity*18));
  const next=clamp(previous*0.84+delta,-100,100);
  this.score=Math.abs(next)<3?0:Math.round(next);
  this.lastEmotion=emotion.primary;
  this.lastSignal=emotion.praiseDetected?"compliment":emotion.insultDetected?"insult":emotion.primary;
  this.updatedAt=Date.now();
  this.source="text-estimate";
  return this.snapshot();
 }
 set(score){
  this.score=Math.round(clamp(Number(score)||0,-100,100));
  this.updatedAt=Date.now();this.source="manual-adjustment";
  this.lastSignal="manual";
  return this.snapshot();
 }
 reset(){this.score=0;this.lastEmotion="undetermined";this.lastSignal="neutral";this.source="baseline";this.updatedAt=Date.now();return this.snapshot();}
 snapshot(){
  const score=this.score;
  return {score,minimum:-100,maximum:100,baseline:0,percentFromBaseline:score,label:affectLabel(score,this.lastEmotion),direction:score>0?"positive":score<0?"negative":"neutral",lastEmotion:this.lastEmotion,lastSignal:this.lastSignal,source:this.source,updatedAt:this.updatedAt,meaning:"Điểm trạng thái cảm xúc mô phỏng từ tín hiệu văn bản hoặc điều chỉnh thủ công; không phải cảm xúc chủ quan."};
 }
 export(){return {score:this.score,lastEmotion:this.lastEmotion,lastSignal:this.lastSignal,updatedAt:this.updatedAt,source:this.source};}
}
export class AgentAffectModel{
 constructor(data={}){
  this.score=Math.round(clamp(Number(data.score)||0,-100,100));
  this.confidence=Math.round(clamp(Number(data.confidence??55),0,100));
  this.engagement=Math.round(clamp(Number(data.engagement??50),0,100));
  this.focus=Math.round(clamp(Number(data.focus??55),0,100));
  this.lastState=data.lastState||"Ổn định";
  this.cycles=Number(data.cycles)||0;
  this.updatedAt=data.updatedAt||Date.now();
 }
 observeOutcome({confidence=0.2,isQuestion=false,hasEvidence=false}={}){
  const certainty=clamp(Number(confidence)||0);
  const delta=(certainty>=0.75?8:certainty>=0.45?2:-7)+(isQuestion?3:0)+(hasEvidence?2:0);
  const next=clamp(this.score*0.88+delta,-100,100);
  this.score=Math.abs(next)<3?0:Math.round(next);
  this.confidence=Math.round(this.confidence*0.65+certainty*100*0.35);
  this.engagement=Math.round(clamp(this.engagement*0.72+26+(isQuestion?10:0)+(hasEvidence?8:0),0,100));
  this.focus=Math.round(clamp(this.focus*0.7+25+certainty*50,0,100));
  this.cycles++;
  this.updatedAt=Date.now();
  this.lastState=certainty<0.3?"Thận trọng":isQuestion&&!hasEvidence?"Tò mò / tìm hiểu":certainty>=0.75?"Tập trung":"Ổn định";
  return this.snapshot();
 }
 set(score){
  this.score=Math.round(clamp(Number(score)||0,-100,100));
  this.lastState="Điều chỉnh thủ công";
  this.updatedAt=Date.now();
  return this.snapshot();
 }
 reset(){this.score=0;this.lastState="Ổn định";this.updatedAt=Date.now();return this.snapshot();}
 snapshot(){
  return {
   score:this.score,minimum:-100,maximum:100,baseline:0,
   label:this.score>=35?"Hứng thú":this.score<=-25?"Thận trọng":"Ổn định",
   mode:this.lastState,confidence:this.confidence,engagement:this.engagement,focus:this.focus,
   cycles:this.cycles,updatedAt:this.updatedAt,
   meaning:"Trạng thái vận hành mô phỏng nội bộ, cập nhật theo độ chắc chắn và tiến trình xử lý; không phải trải nghiệm chủ quan."
  };
 }
 export(){return {score:this.score,confidence:this.confidence,engagement:this.engagement,focus:this.focus,lastState:this.lastState,cycles:this.cycles,updatedAt:this.updatedAt};}
}
export class FamiliarityModel{
 constructor(data={}){this.turns=Number(data.turns)||0;this.firstSeen=data.firstSeen||null;this.lastSeen=data.lastSeen||null;this.styleCounts=data.styleCounts||{};}
 observe(input,at=Date.now()){
  this.turns++;this.firstSeen=this.firstSeen||at;this.lastSeen=at;
  const q=String(input);
  const style=/\b(tui|toi|mình|minh)\b/i.test(q)?"casual-first-person":/\b(quý|kính|please|sir|madam)\b/i.test(q)?"formal":"unmarked";
  this.styleCounts[style]=(this.styleCounts[style]||0)+1;
  return this.snapshot(at);
 }
 snapshot(at=Date.now()){
  const level=this.turns<3?"new":this.turns<12?"occasional":this.turns<40?"familiar":"frequent";
  return {level,interactionCount:this.turns,daysSinceFirst:this.firstSeen?Math.max(0,Math.floor((at-this.firstSeen)/86400000)):0,communicationStyle:Object.entries(this.styleCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||"unknown",meaning:"Chỉ mô tả lịch sử tương tác trong bộ nhớ cục bộ; không phải mức độ tình cảm hay quan hệ cá nhân."};
 }
 reset(){this.turns=0;this.firstSeen=null;this.lastSeen=null;this.styleCounts={};}
 export(){return {turns:this.turns,firstSeen:this.firstSeen,lastSeen:this.lastSeen,styleCounts:this.styleCounts};}
}
export class HumanCognitiveSystems{
 constructor(data={}){this.familiarity=new FamiliarityModel(data.familiarity);this.affect=new AffectiveState(data.userAffect||data.affect);this.agentAffect=new AgentAffectModel(data.agentAffect);this.lastProfile=null;}
 process(input){
  const emotion=recognizeEmotion(input),question=classifyQuestion(input),dialogueAct=classifyDialogueAct(input),familiarity=this.familiarity.observe(input),affect=this.affect.observe(input,emotion);
  const attention=words(input).filter(w=>w.length>3).slice(-8);
  const language=question.language&&question.language!=="und"?question.language:emotion.language;
  this.lastProfile={emotion,question,dialogueAct,familiarity,affect,userAffect:affect,agentAffect:this.agentAffect.snapshot(),language,attention,selfMonitoring:{uncertainty:Math.max(0,1-Math.max(emotion.confidence,question.confidence)),needsClarification:question.isQuestion&&question.confidence<0.55}};
  return this.lastProfile;
 }
 recordOutcome({confidence=0.2,question=this.lastProfile?.question}={}){
  const agentAffect=this.agentAffect.observeOutcome({confidence,isQuestion:Boolean(question?.isQuestion),hasEvidence:Number(confidence)>=0.65});
  const userScore=this.affect.snapshot().score;
  const adaptation=userScore<=-30?"supportive":question?.isQuestion&&question.confidence<0.6?"clarifying":agentAffect.confidence<40||agentAffect.focus<40?"cautious":this.lastProfile?.language?.language==="und"?"language-aware":"direct";
  if(this.lastProfile){this.lastProfile.agentAffect=agentAffect;this.lastProfile.adaptation=adaptation;}
  return {agentAffect,adaptation};
 }
 setAffect(score){return this.affect.set(score);}
 resetAffect(){return this.affect.reset();}
 setAgentAffect(score){return this.agentAffect.set(score);}
 resetAgentAffect(){return this.agentAffect.reset();}
 reset(){this.familiarity.reset();this.affect.reset();this.agentAffect=new AgentAffectModel();}
 export(){return {familiarity:this.familiarity.export(),affect:this.affect.export(),userAffect:this.affect.export(),agentAffect:this.agentAffect.export()};}
}
