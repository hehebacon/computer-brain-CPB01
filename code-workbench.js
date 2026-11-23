/* CPB-01 local code workbench.
 * Markdown is escaped; HTML preview is static-only.
 * JavaScript runs in a DOM-less Worker without common network APIs and with a hard timeout.
 */
export const CODE_LIMITS=Object.freeze({maxBytes:160000,defaultTimeoutMs:2500,maxTimeoutMs:8000,maxOutputChars:12000});
export function escapeHTML(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
export function createCodeMarkdown({title="Code sample",language="text",code="",notes=[]}={}){
 const safeLanguage=String(language||"text").replace(/[^a-z0-9_+-]/gi,"").slice(0,24)||"text";
 const tick=String.fromCharCode(96),runs=String(code).match(new RegExp(tick+"+","g"))||[],fence=tick.repeat(Math.max(3,...runs.map(x=>x.length+1)));
 return ["# "+String(title),...(notes.length?["",...notes.map(n=>"- "+String(n))]:[]),"",fence+safeLanguage,String(code),fence,""].join("\n");
}
export const CODE_TEMPLATES=Object.freeze({
 "html-starter":{filename:"index.html",language:"html",code:"<!doctype html>\n<html lang=\"vi\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <title>Trang mới</title>\n  <style>body{max-width:760px;margin:3rem auto;padding:1rem;font-family:system-ui,sans-serif}</style>\n</head>\n<body><main><h1>Xin chào!</h1><p>Bắt đầu xây dựng tại đây.</p></main></body>\n</html>"},
 "javascript-module":{filename:"app.js",language:"javascript",code:"/** Small, dependency-free module. */\nexport function main(input) {\n  if (input == null) throw new TypeError(\"input is required\");\n  return { ok: true, value: input };\n}\nconsole.log(main(\"CPB-01\"));"},
 "python-script":{filename:"main.py",language:"python",code:"def main(value: str) -> dict[str, object]:\n    if not value:\n        raise ValueError(\"value must not be empty\")\n    return {\"ok\": True, \"value\": value}\n\nif __name__ == \"__main__\":\n    print(main(\"CPB-01\"))"},
 "css-theme":{filename:"styles.css",language:"css",code:":root {\n  color-scheme: dark;\n  font-family: system-ui, sans-serif;\n  --surface: #101827;\n  --text: #e7edf5;\n  --accent: #80d8c2;\n}\n.card {\n  padding: 1rem;\n  border: 1px solid var(--accent);\n  border-radius: 1rem;\n  background: var(--surface);\n  color: var(--text);\n}"},
 "readme":{filename:"README.md",language:"markdown",code:"# Project name\n\n## Purpose\nDescribe what the project does.\n\n## Getting started\n\n~~~bash\nnpm install\nnpm test\n~~~\n\n## Usage\nAdd a small example and document expected inputs/outputs.\n\n## Limitations\nList known constraints and safety notes."}
});
const KEYWORDS={
 javascript:"const let var function return if else for while class new throw try catch async await import export from switch case break continue true false null undefined",
 typescript:"const let var function return if else for while class new throw try catch async await import export type interface implements extends true false null undefined",
 python:"def return if elif else for while class import from as try except finally with lambda yield async await pass raise True False None",
 html:"html head body main section article header footer div span p h1 h2 h3 a button input form label script style",
 css:"color background display flex grid position relative absolute fixed margin padding border radius width height font-size transform transition root hover",
 json:"true false null"
};
function highlightCode(code,language){
 const lang=String(language||"").toLowerCase(),keywords=new Set((KEYWORDS[lang]||KEYWORDS.javascript).split(/\s+/));
 const pattern=/(\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|[A-Za-z_$][\w$]*)/g;
 let out="",last=0,match;
 while((match=pattern.exec(String(code)))){
  out+=escapeHTML(String(code).slice(last,match.index));
  const token=match[0],escaped=escapeHTML(token);
  const cls=token.startsWith("//")||token.startsWith("#")?"tok-comment":/^["']/.test(token)?"tok-string":/^\d/.test(token)?"tok-number":keywords.has(token)?"tok-keyword":"";
  out+=cls?'<span class="'+cls+'">'+escaped+"</span>":escaped;last=pattern.lastIndex;
 }
 return out+escapeHTML(String(code).slice(last));
}
function renderInline(source){
 const tick=String.fromCharCode(96),inlineCode=new RegExp(tick+"([^"+tick+"]+)"+tick,"g");
 let value=escapeHTML(source).replace(inlineCode,"<code>$1</code>");
 value=value.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/\*([^*]+)\*/g,"<em>$1</em>");
 return value.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}
export function renderMarkdownPreview(markdown){
 const lines=String(markdown??"").replace(/\r\n?/g,"\n").split("\n"),html=[],paragraph=[],list=[];
 const flushParagraph=()=>{if(paragraph.length){html.push("<p>"+paragraph.map(renderInline).join(" ")+"</p>");paragraph.length=0;}};
 const flushList=()=>{if(list.length){html.push("<ul>"+list.map(x=>"<li>"+renderInline(x)+"</li>").join("")+"</ul>");list.length=0;}};
 const tick=String.fromCharCode(96),fenceRegex=new RegExp("^\\s*(?:"+tick+"{3,}|~{3,})([a-zA-Z0-9_+-]*)\\s*$");
 let inCode=false,code=[],language="text";
 for(const line of lines){
  const fence=line.match(fenceRegex);
  if(fence){
   if(!inCode){flushParagraph();flushList();inCode=true;language=fence[1]||"text";code=[];}
   else{html.push('<pre class="cpb-code"><code class="language-'+escapeHTML(language)+'">'+highlightCode(code.join("\n"),language)+"</code></pre>");inCode=false;}
   continue;
  }
  if(inCode){code.push(line);continue;}
  const heading=line.match(/^(#{1,4})\s+(.+)$/),bullet=line.match(/^\s*[-*+]\s+(.+)$/);
  if(!line.trim()){flushParagraph();flushList();continue;}
  if(heading){flushParagraph();flushList();const n=heading[1].length;html.push("<h"+n+">"+renderInline(heading[2])+"</h"+n+">");continue;}
  if(bullet){flushParagraph();list.push(bullet[1]);continue;}
  if(/^\s*>/.test(line)){flushParagraph();flushList();html.push("<blockquote>"+renderInline(line.replace(/^\s*>\s?/,""))+"</blockquote>");continue;}
  flushList();paragraph.push(line);
 }
 if(inCode)html.push('<pre class="cpb-code"><code class="language-'+escapeHTML(language)+'">'+highlightCode(code.join("\n"),language)+"</code></pre>");
 flushParagraph();flushList();
 return '<article class="cpb-markdown">'+html.join("\n")+'</article><style>.cpb-markdown{font:14px/1.6 system-ui,sans-serif;color:inherit;overflow-wrap:anywhere}.cpb-markdown h1,.cpb-markdown h2,.cpb-markdown h3,.cpb-markdown h4{line-height:1.25;margin:1.1em 0 .45em}.cpb-markdown pre{overflow:auto;padding:1em;border-radius:10px;background:#0b1220;color:#e5edf8}.cpb-markdown code{font-family:ui-monospace,monospace}.cpb-markdown p code{background:#273449;padding:.12em .3em;border-radius:4px}.cpb-markdown .tok-keyword{color:#d8a7ff}.cpb-markdown .tok-string{color:#a5dc9b}.cpb-markdown .tok-number{color:#f4bd7f}.cpb-markdown .tok-comment{color:#8996aa}.cpb-markdown blockquote{border-left:3px solid #6eaaab;padding-left:1em;color:#9caec3}.cpb-markdown a{color:#80cfff}</style>';
}
export function mountMarkdownPreview(container,markdown){
 if(!container||typeof container!=="object")throw new TypeError("A preview container is required.");
 container.innerHTML=renderMarkdownPreview(markdown);return container;
}
function stripActiveHtml(html){
 return String(html??"")
  .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,"")
  .replace(/<(iframe|object|embed|form|base)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,"")
  .replace(/<(iframe|object|embed|form|base)\b[^>]*\/?>/gi,"")
  .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,"")
  .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi,"");
}
export function buildSandboxDocument(source){
 const code=String(source??"");
 if(new TextEncoder().encode(code).length>CODE_LIMITS.maxBytes)throw new RangeError("Mã vượt quá giới hạn 160 KB.");
 const csp='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'none\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:; connect-src \'none\'; media-src data: blob:; object-src \'none\'; frame-src \'none\'; form-action \'none\'; base-uri \'none\'; navigate-to \'none\'">';
 let html=stripActiveHtml(code);
 if(/<html[\s>]/i.test(html)){
  if(/<head[\s>]/i.test(html))html=html.replace(/<head([^>]*)>/i,"<head$1>"+csp);
  else html=html.replace(/<html([^>]*)>/i,"<html$1><head>"+csp+"</head>");
 }else html="<!doctype html><html lang=\"vi\"><head><meta charset=\"utf-8\">"+csp+"</head><body>"+html+"</body></html>";
 return html;
}
export function mountSandbox({iframe,source,timeoutMs=CODE_LIMITS.defaultTimeoutMs,onStatus=()=>{}}={}){
 if(!iframe)throw new TypeError("An iframe is required");
 const timeout=Math.max(250,Math.min(CODE_LIMITS.maxTimeoutMs,Number(timeoutMs)||CODE_LIMITS.defaultTimeoutMs));
 let finished=false;
 iframe.setAttribute("sandbox","");iframe.setAttribute("referrerpolicy","no-referrer");
 const finish=status=>{if(finished)return;finished=true;clearTimeout(timer);onStatus(status);};
 const onLoad=()=>finish("completed");
 const timer=setTimeout(()=>{iframe.srcdoc="<!doctype html><title>Preview stopped</title><p>Preview time limit reached.</p>";finish("timeout");},timeout);
 try{iframe.addEventListener("load",onLoad,{once:true});iframe.srcdoc=buildSandboxDocument(source);onStatus("running");}
 catch(error){finish("error");throw error;}
 return ()=>{iframe.removeEventListener("load",onLoad);clearTimeout(timer);iframe.srcdoc="about:blank";};
}
export function buildWorkerSource(source){
 const code=String(source??"");
 if(new TextEncoder().encode(code).length>CODE_LIMITS.maxBytes)throw new RangeError("Mã vượt quá giới hạn 160 KB.");
 const lines=[
  "const __cap="+CODE_LIMITS.maxOutputChars+";",
  "const __logs=[];",
  "const __text=value=>{try{return typeof value==='string'?value:JSON.stringify(value)??String(value);}catch{return String(value);}};",
  "const __clip=value=>String(value).slice(0,__cap);",
  "const __send=payload=>{try{postMessage(payload);}catch{postMessage({type:'cpb01-result',ok:false,error:'Unable to serialize sandbox result.'});}};",
  "const __console={log:(...a)=>__logs.push(__clip(a.map(__text).join(' '))),info:(...a)=>__logs.push(__clip(a.map(__text).join(' '))),warn:(...a)=>__logs.push('WARN: '+__clip(a.map(__text).join(' '))),error:(...a)=>__logs.push('ERROR: '+__clip(a.map(__text).join(' ')))};",
  "try{Object.defineProperty(globalThis,'console',{value:Object.freeze(__console),writable:false,configurable:false});}catch{}",
  "for(const __name of ['fetch','XMLHttpRequest','WebSocket','EventSource','Worker','SharedWorker','importScripts','BroadcastChannel','WebTransport','RTCPeerConnection','indexedDB','caches','navigator']){try{Object.defineProperty(globalThis,__name,{value:undefined,writable:false,configurable:false});}catch{}}",
  "async function __run(){try{const __result=await (async function(){",
  code,
  "})();__send({type:'cpb01-result',ok:true,result:__result===undefined?'':__clip(__text(__result)),logs:__logs.join('\\n').slice(0,__cap)});}catch(__error){__send({type:'cpb01-result',ok:false,error:__clip(__error?.stack||__error?.message||String(__error)),logs:__logs.join('\\n').slice(0,__cap)});}}",
  "__run();"
 ];
 return lines.join("\n");
}
function defaultWorkerFactory(source){
 if(typeof Worker==="undefined"||typeof Blob==="undefined"||typeof URL?.createObjectURL!=="function")throw new Error("Web Worker sandbox is not supported in this browser.");
 const blob=new Blob([source],{type:"text/javascript"}),url=URL.createObjectURL(blob);
 try{const worker=new Worker(url,{name:"cpb01-code-sandbox"});return {worker,revoke:()=>URL.revokeObjectURL(url)};}
 catch(error){URL.revokeObjectURL(url);throw error;}
}
export class CodeWorkbench{
 constructor({workerFactory=defaultWorkerFactory}={}){this.workerFactory=workerFactory;}
 markdown(options){return createCodeMarkdown(options);}
 previewMarkdown(markdown){return renderMarkdownPreview(markdown);}
 template(name){const template=CODE_TEMPLATES[name];return template?{...template}:null;}
 runJavaScript(source,{timeoutMs=CODE_LIMITS.defaultTimeoutMs}={}){
  const script=buildWorkerSource(source),timeout=Math.max(250,Math.min(CODE_LIMITS.maxTimeoutMs,Number(timeoutMs)||CODE_LIMITS.defaultTimeoutMs));
  let created;try{created=this.workerFactory(script);}catch(error){return Promise.resolve({ok:false,error:String(error?.message||error),logs:"",timedOut:false});}
  const worker=created.worker||created,revoke=created.revoke||(()=>{});
  return new Promise(resolve=>{
   let finished=false;
   const finish=result=>{if(finished)return;finished=true;clearTimeout(timer);try{worker.terminate();}catch{}try{revoke();}catch{}resolve(result);};
   const timer=setTimeout(()=>finish({ok:false,error:"Execution time limit reached ("+timeout+" ms). Worker terminated.",logs:"",timedOut:true}),timeout);
   worker.onmessage=event=>{const data=event.data||{};if(data.type!=="cpb01-result")return;finish({ok:Boolean(data.ok),result:String(data.result||""),error:String(data.error||""),logs:String(data.logs||"").slice(0,CODE_LIMITS.maxOutputChars),timedOut:false});};
   worker.onerror=event=>finish({ok:false,error:String(event.message||"Sandbox worker error."),logs:"",timedOut:false});
   try{worker.postMessage({type:"cpb01-run"});}catch(error){finish({ok:false,error:String(error?.message||error),logs:"",timedOut:false});}
  });
 }
}
