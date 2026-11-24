/* CPB-01 Response Evaluator v0.1
 * Ranks only grounded response candidates. It never invents missing facts.
 */
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,Number(n)||0));
const traceStep=(result,stage)=>result?.trace?.find(step=>step.stage===stage)||null;

function candidateScore(candidate){
 const weights={intentMatch:0.30,evidenceSupport:0.30,answerConfidence:0.25,contextFit:0.15};
 const score=Object.entries(weights).reduce((sum,[key,weight])=>sum+clamp(candidate.signals[key])*weight,0);
 return {...candidate,score:Number(score.toFixed(4))};
}

export function evaluateResponse({input="",understanding={},result={},context={}}={}){
 const candidates=[];
 const resultConfidence=clamp(result.confidence);
 const hasEvidence=Boolean(traceStep(result,"memory-retrieval")?.matches||traceStep(result,"answer-planning")?.evidenceCount);
 const contextUsed=Boolean(traceStep(result,"dialogue-management")?.usedContext);
 const answer=String(result.text||"").trim();

 if(answer){
  candidates.push(candidateScore({
   id:"kernel-answer",text:answer,kind:"existing-kernel-answer",
   signals:{
    intentMatch:clamp(traceStep(result,"intent-classification")?.confidence||0.35),
    evidenceSupport:hasEvidence?0.95:(resultConfidence>=0.8?0.85:0.45),
    answerConfidence:resultConfidence,
    contextFit:contextUsed?0.95:(context?.currentTopic?0.8:0.9)
   },
   reason:"Giữ câu trả lời do kernel tạo; không thêm dữ kiện mới."
  }));
 }

 if(understanding.intentHint==="greeting"){
  candidates.push(candidateScore({
   id:"recognized-greeting",text:"Chào ông :D Tui đã nhận ra lời chào của ông rồi. Ông muốn tìm hiểu điều gì?",
   kind:"intent-template",signals:{
    intentMatch:1,
    evidenceSupport:1,
    answerConfidence:clamp(understanding.confidence,0.82,1),
    contextFit:1
   },
   reason:"Đầu vào khớp duy nhất với mẫu lời chào đã biết sau khi chuẩn hóa."
  }));
 }

 if(!candidates.length||resultConfidence<0.25){
  candidates.push(candidateScore({
   id:"clarification",text:"Tui chưa xác định chắc ý ông muốn nói. Ông có thể diễn đạt lại bằng một câu ngắn hơn không?",
   kind:"clarification",signals:{
    intentMatch:0.8,
    evidenceSupport:1,
    answerConfidence:0.9,
    contextFit:context?.currentTopic?0.85:1
   },
   reason:"Không có phương án trả lời đủ căn cứ; hỏi lại an toàn hơn đoán."
  }));
 }

 candidates.sort((a,b)=>b.score-a.score);
 const selected=candidates[0];
 const threshold=0.62;
 const accepted=selected.score>=threshold;
 const fallback=candidates.find(item=>item.id==="clarification");
 const finalCandidate=accepted?selected:(fallback||selected);
 return {
  text:finalCandidate.text,
  confidence:finalCandidate.id==="recognized-greeting"?clamp(understanding.confidence):finalCandidate.id==="clarification"?Math.min(0.2,resultConfidence):accepted?resultConfidence:Math.min(0.3,resultConfidence),
  rankingScore:finalCandidate.score,
  selectedId:finalCandidate.id,
  accepted,
  threshold,
  candidates:candidates.map(({id,kind,score,signals,reason})=>({id,kind,score,signals,reason})),
  reason:accepted?finalCandidate.reason:"Không ứng viên nào vượt ngưỡng; chuyển sang hỏi lại thay vì khẳng định."
 };
}
