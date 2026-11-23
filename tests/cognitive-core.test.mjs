import test from "node:test";
import assert from "node:assert/strict";
import { CognitiveCore, CognitiveMemory } from "../cognitive-core.js";

test("cognitive cycle stores and recalls user-provided facts",()=>{
 const core=new CognitiveCore(new CognitiveMemory());
 const learned=core.process("Ghi nhớ: Trái Đất | là | hành tinh",null);
 assert.match(learned.text,/đã lưu/i);
 const answer=core.process("Trái Đất là gì?",null);
 assert.match(answer.text,/Trái Đất là hành tinh/);
 assert.equal(answer.trace.some(x=>x.stage==="memory-retrieval"),true);
});

test("can derive a cautious two-link relation",()=>{
 const memory=new CognitiveMemory();
 memory.learn("Sao Hỏa","là","hành tinh","test",0.9);
 memory.learn("hành tinh","thuộc nhóm","thiên thể","test",0.8);
 const result=new CognitiveCore(memory).process("Sao Hỏa là gì?",null);
 assert.match(result.text,/thiên thể/);
 assert.match(result.text,/suy luận/);
 assert.ok(result.confidence<0.8);
});

test("arithmetic parser handles precedence, parentheses and powers",()=>{
 const core=new CognitiveCore();
 assert.match(core.process("tính 2 + 3 * 4",null).text,/14/);
 assert.match(core.process("tính (2 + 3) * 4",null).text,/20/);
 assert.match(core.process("tính 2 ^ 3",null).text,/8/);
});

test("arithmetic parser rejects division by zero and non-math syntax",()=>{
 const core=new CognitiveCore();
 assert.match(core.process("tính 9 / 0",null).text,/chia cho 0/);
 assert.match(core.process("tính 2 + abc",null).text,/chưa tính được/);
});

test("working state tracks conversational turns without claiming feelings",()=>{
 const core=new CognitiveCore();
 core.process("Tôi đang lo lắng",null);
 assert.equal(core.state.turn,1);
 assert.equal(core.state.affect.label,"negative-tone");
 assert.equal(core.memory.episodes.length,0);
});

test("recognizes an unaccented definition question before fact extraction",()=>{
 const memory=new CognitiveMemory();
 const core=new CognitiveCore(memory);
 const result=core.process("trai dat la gi",null);
 assert.match(result.text,/Trái Đất là hành tinh/);
 assert.equal(result.trace.find(x=>x.stage==="intent-classification").intent,"question-definition");
 assert.equal(memory.semantic.some(f=>/la gi/i.test(f.object)),false);
});

test("stores a statement but does not store a question as a fact",()=>{
 const memory=new CognitiveMemory();
 const core=new CognitiveCore(memory);
 const before=memory.semantic.length;
 const result=core.process("Sao Mộc là hành tinh",null);
 assert.match(result.text,/đã lưu dữ kiện/i);
 assert.equal(memory.semantic.some(f=>f.subject==="Sao Mộc"&&f.object==="hành tinh"),true);
 const question=core.process("Sao Mộc là gì?",null);
 assert.equal(question.trace.find(x=>x.stage==="intent-classification").intent,"question-definition");
 assert.equal(memory.semantic.length,before+1);
});

import { HumanCognitiveSystems, recognizeEmotion, classifyQuestion, AffectiveState, detectLanguageHint, registerLanguagePack } from "../human-cognitive-systems.js";

test("HCS recognizes emotional language as uncertain signals",()=>{
 const e=recognizeEmotion("Tui vui quá, tuyệt vời!");
 assert.equal(e.primary,"joy");
 assert.ok(e.confidence<1);
 assert.ok(e.intensity>0);
 assert.match(e.caveat,/Ước lượng/);
});
test("HCS classifies question types including unaccented Vietnamese",()=>{
 assert.equal(classifyQuestion("Tai sao may bay co the bay?").type,"cause");
 assert.equal(classifyQuestion("Trai Dat la gi").type,"definition");
 assert.equal(classifyQuestion("Bao nhieu nguoi?").type,"quantity");
 assert.equal(classifyQuestion("Hom nay vui qua").isQuestion,false);
});
test("HCS tracks interaction familiarity without describing a relationship",()=>{
 const h=new HumanCognitiveSystems();
 const first=h.process("Chào, tui muốn hỏi");
 assert.equal(first.familiarity.level,"new");
 h.process("Cảm ơn");
 h.process("Tui muốn biết thêm");
 const later=h.process("Giải thích tiếp nhé");
 assert.equal(later.familiarity.level,"occasional");
 assert.equal(later.familiarity.interactionCount,4);
 assert.match(later.familiarity.meaning,/không phải mức độ tình cảm/);
});
test("HCS identifies dialogue acts and is integrated into cognitive traces",()=>{
 const h=new HumanCognitiveSystems();
 assert.equal(h.process("Cảm ơn nhé").dialogueAct,"thanks");
 const core=new CognitiveCore(new CognitiveMemory());
 const result=core.process("Tui đang lo lắng, giúp tui với",null);
 assert.equal(core.lastHCS.emotion.primary,"fear");
 assert.ok(result.trace.some(x=>x.stage==="human-cognitive-systems"));
});


test("HCS detects praise and insults as separate sentiment signals",()=>{
 const praise=recognizeEmotion("Bạn làm tốt lắm, tuyệt vời!");
 assert.equal(praise.praiseDetected,true);
 assert.ok(praise.valence>0);
 const insult=recognizeEmotion("You are useless!");
 assert.equal(insult.insultDetected,true);
 assert.ok(insult.valence<0);
});

test("affect meter rises, falls toward neutral, and supports bounded manual adjustment",()=>{
 const affect=new AffectiveState();
 const positive=recognizeEmotion("You are amazing!");
 assert.ok(affect.observe("You are amazing!",positive).score>0);
 const high=affect.set(100);
 assert.equal(high.score,100);
 affect.set(-100);
 assert.equal(affect.snapshot().score,-100);
 affect.reset();
 assert.equal(affect.snapshot().label,"Bình thường");
 assert.equal(affect.snapshot().score,0);
 for(let i=0;i<6;i++)affect.observe("Bạn làm tốt lắm, tuyệt vời!");
 assert.ok(affect.snapshot().score>25);
 for(let i=0;i<30;i++)affect.observe("Hôm nay trời quang.");
 assert.equal(affect.snapshot().score,0);
});

test("HCS classifies common question patterns across supported languages",()=>{
 assert.equal(classifyQuestion("Why does Earth orbit the Sun?").type,"cause");
 assert.equal(classifyQuestion("¿Dónde está la estación?").type,"location");
 assert.equal(classifyQuestion("Warum ist der Himmel blau?").type,"cause");
 assert.equal(classifyQuestion("为什么天空是蓝色的？").type,"cause");
 assert.equal(classifyQuestion("なぜ空は青いのですか？").type,"cause");
 assert.equal(classifyQuestion("왜 하늘은 파란가요?").type,"cause");
 assert.equal(detectLanguageHint("なぜ空は青いのですか？").language,"ja");
});

test("cognitive intent pipeline recognizes multilingual questions without storing them as facts",()=>{
 const memory=new CognitiveMemory();
 const core=new CognitiveCore(memory);
 const before=memory.semantic.length;
 const result=core.process("Why does Earth orbit the Sun?",null);
 assert.equal(result.trace.find(x=>x.stage==="intent-classification").intent,"question");
 assert.equal(memory.semantic.length,before);
 assert.equal(core.lastHCS.question.type,"cause");
});


test("language packs can extend emotion, question and language recognition",()=>{
 const registration=registerLanguagePack({
  code:"xx",
  cues:["zorb"],
  emotions:{joy:["glimmerful"]},
  praise:["you are zorb"],
  questions:[{phrase:"zorbwhy",type:"cause"}],
  dialogueActs:{thanks:["zorbthanks"]}
 });
 assert.equal(registration.registered,true);
 assert.equal(detectLanguageHint("zorb phrase").language,"xx");
 assert.equal(recognizeEmotion("glimmerful").primary,"joy");
 assert.equal(recognizeEmotion("you are zorb").praiseDetected,true);
 assert.equal(classifyQuestion("zorbwhy stars shine?").type,"cause");
});

test("CJK question prefixes are detected without spaces",()=>{
 assert.equal(classifyQuestion("为什么天空是蓝色的？").type,"cause");
 assert.equal(classifyQuestion("どうして空は青いの？").type,"cause");
 assert.equal(classifyQuestion("什么是地球？").type,"definition");
});
