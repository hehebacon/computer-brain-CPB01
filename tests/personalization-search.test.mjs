import test from "node:test";
import assert from "node:assert/strict";
import { PersonalizationModel } from "../personalization.js";
import { composeSearchAnswer } from "../answer-synthesizer.js";
import { SearchClient } from "../search-client.js";

test("personalization records explicit presentation preferences",()=>{
 const profile=new PersonalizationModel();
 const short=profile.observe("Hãy trả lời ngắn gọn");
 assert.equal(short.profile.preferences.detail,"concise");
 profile.observe("Giải thích chi tiết hơn nhé");
 assert.equal(profile.snapshot().preferences.detail,"detailed");
 profile.setPreferences({tone:"formal",language:"en",examples:"always"});
 assert.equal(profile.snapshot().preferences.tone,"formal");
 assert.match(profile.adaptText("Tui sẽ giải thích cho ông."),/Tôi sẽ giải thích cho bạn/);
});

test("search synthesis ranks sources and keeps local memory separate",()=>{
 const facts=[{subject:"Trái Đất",relation:"quay quanh",object:"Mặt Trời",source:"user-stated"}];
 const result=composeSearchAnswer("Trái Đất quay quanh Mặt Trời",[
  {title:"Earth facts",url:"https://science.example/earth",snippet:"Trái Đất quay quanh Mặt Trời theo quỹ đạo.",source:"science.example"},
  {title:"Unrelated cooking page",url:"https://food.example/recipes",snippet:"Công thức nấu ăn và nguyên liệu.",source:"food.example"},
  {title:"Unsafe URL ignored",url:"http://bad.example",snippet:"Trái Đất"}
 ],{preferences:{detail:"detailed",tone:"casual",language:"vi",examples:"when-useful"},memoryFacts:facts});
 assert.equal(result.sources.length,2);
 assert.equal(result.sources[0].title,"Earth facts");
 assert.equal(result.reasoning.method,"query-term-overlap-ranking");
 assert.equal(result.reasoning.localMemoryFactsUsed,1);
 assert.match(result.text,/chưa xác minh độc lập/);
 assert.equal(result.searchCoverage,"low");
});

test("concise response preference changes search synthesis length",()=>{
 const results=[
  {title:"A",url:"https://a.example/page",snippet:"Dữ kiện về Trái Đất và Mặt Trời."},
  {title:"B",url:"https://b.example/page",snippet:"Thông tin bổ sung về Trái Đất."},
  {title:"C",url:"https://c.example/page",snippet:"Bài nghiên cứu về Mặt Trời."}
 ];
 const answer=composeSearchAnswer("Trái Đất Mặt Trời",results,{preferences:{detail:"concise",language:"vi"}});
 assert.equal(answer.sources.length,2);
 assert.match(answer.text,/Kết quả liên quan nhất/);
});

test("search client validates the Worker endpoint and refuses insecure remote URLs",()=>{
 const client=new SearchClient();
 assert.throws(()=>client.configure("http://search.example.com"),/HTTPS/);
 assert.equal(client.configure("http://localhost:8788"),"http://localhost:8788");
 assert.equal(client.configured,true);
 client.configure("");
 assert.equal(client.configured,false);
});
