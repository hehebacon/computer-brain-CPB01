/* CPB-01 local code workbench.
 * HTML preview uses an opaque-origin iframe: no same-origin, network, forms, popups, or top navigation.
 */
export const CODE_LIMITS=Object.freeze({maxBytes:160000,defaultTimeoutMs:2500,maxTimeoutMs:8000});
export function escapeHTML(value){
 return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
export function createCodeMarkdown({title="Code sample",language="text",code="",notes=[]}={}){
 const safeLanguage=String(language||"text").replace(/[^a-z0-9_+-]/gi,"").slice(0,24)||"text";
 const ticks=String.fromCharCode(96);
 const runs=String(code).match(new RegExp(ticks+"+","g"))||[];
 const fence=ticks.repeat(Math.max(3,...runs.map(x=>x.length+1)));
 return ["# "+String(title),...(notes.length?["",...notes.map(n=>"- "+String(n))]:[]),"",fence+safeLanguage,String(code),fence,""].join("\n");
}
export function buildSandboxDocument(source){
 const code=String(source??"");
 if(new TextEncoder().encode(code).length>CODE_LIMITS.maxBytes)throw new RangeError("Mã vượt quá giới hạn 160 KB.");
 const csp="<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; media-src data: blob:; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'; navigate-to 'none'\">";
 const boot="<script>parent.postMessage({type:'cpb01-sandbox-ready'},'*');<\\/script>";
 let html=code;
 if(/<html[\\s>]/i.test(html)){
  if(/<head[\\s>]/i.test(html))html=html.replace(/<head([^>]*)>/i,"<head$1>"+csp);
  else html=html.replace(/<html([^>]*)>/i,"<html$1><head>"+csp+"</head>");
 }else html="<!doctype html><html><head><meta charset=\"utf-8\">"+csp+"</head><body>"+html+"</body></html>";
 return html.replace(/<\\/body>/i,boot+"</body>");
}
export function mountSandbox({iframe,source,timeoutMs=CODE_LIMITS.defaultTimeoutMs,onStatus=()=>{}}={}){
 if(!iframe)throw new TypeError("An iframe is required");
 const timeout=Math.max(250,Math.min(CODE_LIMITS.maxTimeoutMs,Number(timeoutMs)||CODE_LIMITS.defaultTimeoutMs));
 let finished=false;
 iframe.setAttribute("sandbox","allow-scripts");
 iframe.setAttribute("referrerpolicy","no-referrer");
 const finish=status=>{if(finished)return;finished=true;clearTimeout(timer);onStatus(status);};
 const onMessage=event=>{if(event.source===iframe.contentWindow&&event.data?.type==="cpb01-sandbox-ready")finish("completed");};
 window.addEventListener("message",onMessage);
 const timer=setTimeout(()=>{iframe.srcdoc="<!doctype html><title>Sandbox stopped</title><p>Execution time limit reached.</p>";finish("timeout");},timeout);
 try{iframe.srcdoc=buildSandboxDocument(source);onStatus("running");}
 catch(error){finish("error");throw error;}
 return ()=>{window.removeEventListener("message",onMessage);clearTimeout(timer);iframe.srcdoc="about:blank";};
}
