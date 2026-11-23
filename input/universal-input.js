/* CPB-01 AllPlus ingestion facade. Unsupported binary extraction is reported honestly. */
(() => {
  const textFormats=new Set(["plain-text","log","markdown","structured-prose","tabular-text","json","jsonl","xml","html","csv","tsv","yaml","key-value-or-yaml","toml","ini","javascript","typescript","tsx","jsx","python","java","c","c-header","cpp","rust","go","ruby","php","shell","css","sql","svg","rtf"]);
  function parseText(text,format) {
    const result={format,valid:null,structure:null,diagnostics:[]};
    if(format==="json") {
      try { const value=JSON.parse(text); result.valid=true; result.structure={kind:Array.isArray(value)?"array":typeof value, value}; }
      catch(e) { result.valid=false; result.diagnostics.push("JSON parse error: "+e.message); }
    } else if(format==="jsonl") {
      const lines=text.split("\n").filter(x=>x.trim()); let valid=0;
      lines.forEach((line,i)=>{try{JSON.parse(line);valid++;}catch(e){result.diagnostics.push("Line "+(i+1)+": "+e.message);}});
      result.valid=valid===lines.length; result.structure={kind:"json-lines",lineCount:lines.length,validLines:valid};
    } else if(format==="csv" || format==="tsv" || format==="tabular-text") {
      const delimiter=format==="tsv"?"\t":",";
      const rows=text.split("\n").filter(x=>x.length).map(line=>line.split(delimiter));
      result.structure={kind:"delimited-table",delimiter,rows:rows.length,maxColumns:Math.max(0,...rows.map(r=>r.length)),consistentColumns:rows.every(r=>r.length===rows[0]?.length)};
      result.valid=result.structure.consistentColumns;
      if(!result.valid) result.diagnostics.push("Rows have inconsistent column counts; quoting and embedded delimiters are not fully parsed in this lightweight adapter.");
    } else if(format==="xml" || format==="html" || format==="svg") {
      result.structure={kind:"markup",tagCount:(text.match(/<\/?[A-Za-z][^>]*>/g)||[]).length};
      if(format==="xml" || format==="svg") {
        try { if(typeof DOMParser!=="undefined"){const doc=new DOMParser().parseFromString(text,"application/xml");const err=doc.querySelector("parsererror");result.valid=!err;if(err)result.diagnostics.push("Markup parser: "+err.textContent.slice(0,300));} }
        catch(e){result.valid=null;result.diagnostics.push(e.message);}
      }
    } else if(format==="markdown") {
      result.structure={kind:"markdown",headings:(text.match(/^#{1,6}\s/gm)||[]).length,codeFences:(text.match(/^\s*```/gm)||[]).length,links:(text.match(/\[[^\]]+\]\([^)]+\)/g)||[]).length};
    } else if(format==="javascript" || format==="typescript" || format==="python" || format==="java" || format==="c" || format==="cpp" || format==="rust" || format==="go" || format==="ruby" || format==="php" || format==="shell" || format==="sql" || format==="css" || format==="tsx" || format==="jsx") {
      result.structure={kind:"source-code",language:format,lineCount:text.split("\n").length};
      result.diagnostics.push("Detected source code. This stage identifies the format; it does not execute or fully compile the code.");
    } else {
      result.structure={kind:"text",lineCount:text.split("\n").length,characterCount:text.length};
    }
    return result;
  }
  async function processText(text,meta={}) {
    const normalized=window.CPBInput.normalizeText(text);
    const detection=window.CPBInput.detectFormat(normalized.normalized,meta.name||"");
    const parsed=parseText(normalized.normalized,detection.format);
    return {ok:true,kind:"text",name:meta.name||null,size:meta.size??new Blob([text]).size,encoding:meta.encoding||"unicode-string",format:detection.format,family:detection.family,normalization:{changed:normalized.changed,unicodeForm:"NFC"},content:normalized.normalized,analysis:parsed,diagnostics:parsed.diagnostics};
  }
  async function processFile(file) {
    const name=file.name||"unnamed";
    const buffer=await file.arrayBuffer();
    const bytes=new Uint8Array(buffer);
    const head=Array.from(bytes.slice(0,12)).map(b=>b.toString(16).padStart(2,"0")).join(" ");
    const signature=bytes.length>=4 && bytes[0]===0x25 && bytes[1]===0x50 && bytes[2]===0x44 && bytes[3]===0x46?"pdf":
      bytes.length>=4 && bytes[0]===0x50 && bytes[1]===0x4b?"zip-container":
      bytes.length>=8 && bytes[0]===0x89 && bytes[1]===0x50?"png":
      bytes.length>=3 && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff?"jpeg":
      bytes.length>=3 && String.fromCharCode(...bytes.slice(0,3))==="ID3"?"mp3":null;
    const decoded=window.CPBInput.decodeBuffer(buffer);
    const looksText=bytes.length===0 || bytes.slice(0,Math.min(bytes.length,4096)).every(b=>b===9||b===10||b===13||b>=32);
    const detection=window.CPBInput.detectFormat(decoded.text,name);
    const format=signature==="zip-container"?(name.toLowerCase().endsWith(".docx")?"docx":"archive"):signature||detection.format;
    if(textFormats.has(format) || (!signature && looksText && detection.family==="text")) {
      return processText(decoded.text,{name,size:file.size,encoding:decoded.encoding});
    }
    const supported={pdf:"PDF",docx:"DOCX",image:"image",audio:"audio",video:"video",archive:"archive", "zip-container":"ZIP/archive",jpeg:"image",png:"image",mp3:"audio"};
    return {ok:true,kind:"binary",name,size:file.size,format,family:detection.family,signature:signature||null,headerHex:head,extraction:{available:false,reason:"The file was identified, but this browser-only build has no dedicated decoder for this binary format. It will not pretend to have read its contents.",needed:format==="pdf"?"PDF text/OCR adapter":format==="docx"?"DOCX/OOXML adapter":(["image","jpeg","png"].includes(format)?"OCR or vision adapter":format==="audio"||format==="mp3"?"speech/audio transcription adapter":format==="video"?"video frame and audio adapter":"format-specific decoder")}};
  }
  window.CPBInput=window.CPBInput||{};
  window.CPBInput.processText=processText;
  window.CPBInput.processFile=processFile;
})();