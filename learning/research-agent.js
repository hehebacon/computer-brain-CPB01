import { assessSource } from "./source-verifier.js";
/** Converts public search results into attributed candidate knowledge; it does not crawl or execute pages. */
export class ResearchAgent {
 constructor({search,learning}={}){if(typeof search!=="function"||!learning)throw new TypeError("search and learning are required");this.search=search;this.learning=learning;}
 async research(topic,{count=6,language="vi"}={}) {
  const response=await this.search(topic,{count,language,mode:"web"});
  const learned=[];
  for(const result of response.results||[]) {
   const assessment=assessSource({url:result.url,title:result.title,publisher:result.source,publishedAt:result.age});
   if(!assessment.accepted||!result.snippet)continue;
   const sourceId=result.url;
   this.learning.addSource({id:sourceId,url:result.url,title:result.title,publisher:result.source,authority:assessment.score,family:new URL(result.url).hostname});
   learned.push(this.learning.learn({id:sourceId,claim:result.snippet,kind:"claim",sourceId,confidence:assessment.score}));
  }
  return {query:topic,learned,provider:response.provider||"configured-search",fetchedAt:response.fetchedAt||new Date().toISOString(),note:"Search snippets are candidate evidence, not verified facts."};
 }
}
