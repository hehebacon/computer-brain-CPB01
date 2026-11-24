import test from "node:test";
import assert from "node:assert/strict";
import { ResearchAgent } from "../learning/research-agent.js";
import { LearningEngine } from "../learning/learning-engine.js";

test("research agent stores search snippets with source attribution",async()=>{
 const learning=new LearningEngine();
 const agent=new ResearchAgent({learning,search:async()=>({provider:"mock",results:[{title:"Official docs",url:"https://docs.example.org/topic",source:"docs.example.org",snippet:"A candidate statement from documentation."}]})});
 const result=await agent.research("topic");
 assert.equal(result.learned.length,1);
 assert.equal(result.learned[0].state,"SUPPORTED");
 assert.equal(result.learned[0].evidence[0].sourceId,"https://docs.example.org/topic");
});
