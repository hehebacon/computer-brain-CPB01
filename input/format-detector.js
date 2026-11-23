/* CPB-01 AllPlus: format and content-family detection. No network or AI dependency. */
(() => {
  const extMap = {
    json:"json", jsonl:"jsonl", ndjson:"jsonl", xml:"xml", html:"html", htm:"html",
    md:"markdown", markdown:"markdown", csv:"csv", tsv:"tsv", txt:"plain-text",
    log:"log", yaml:"yaml", yml:"yaml", toml:"toml", ini:"ini",
    js:"javascript", mjs:"javascript", cjs:"javascript", ts:"typescript", tsx:"tsx",
    jsx:"jsx", py:"python", java:"java", c:"c", h:"c-header", cpp:"cpp", rs:"rust",
    go:"go", rb:"ruby", php:"php", sh:"shell", bash:"shell", css:"css", sql:"sql",
    pdf:"pdf", docx:"docx", odt:"odt", rtf:"rtf", png:"image", jpg:"image",
    jpeg:"image", gif:"image", webp:"image", bmp:"image", svg:"svg", mp3:"audio",
    wav:"audio", ogg:"audio", m4a:"audio", flac:"audio", mp4:"video", mov:"video",
    webm:"video", zip:"archive", gz:"archive"
  };
  const textExt = new Set(["json","jsonl","xml","html","markdown","csv","tsv","plain-text","log","yaml","toml","ini","javascript","typescript","tsx","jsx","python","java","c","c-header","cpp","rust","go","ruby","php","shell","css","sql","svg","rtf"]);
  function extension(name="") { const m=name.toLowerCase().match(/\.([^.]+)$/); return m ? m[1] : ""; }
  function sniff(text) {
    const s=text.trim();
    if (!s) return "plain-text";
    if (/^(\s*<\?xml\b|\s*<[A-Za-z][\w:.-]*(?:\s|>|\/))/i.test(s)) return /<html\b|<!doctype\s+html/i.test(s) ? "html" : "xml";
    if (/^(\s*\{|\s*\[)/.test(s)) { try { JSON.parse(s); return "json"; } catch {} }
    if (/^\s*#{1,6}\s/m.test(s) || /\[[^\]]+\]\([^)]+\)/.test(s)) return "markdown";
    if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\b/im.test(s)) return "sql";
    if (/^\s*(import |export |const |let |function |class )/m.test(s)) return "javascript";
    if (/^\s*(def |class |import |from )/m.test(s)) return "python";
    if (/^\s*[-*+]\s+\S/m.test(s) || /^\s*\d+\.\s+\S/m.test(s)) return "structured-prose";
    if (/^\s*[^\s:=]+\s*:\s*.+/m.test(s)) return "key-value-or-yaml";
    if (/\t/.test(s) && s.includes("\n")) return "tabular-text";
    return "plain-text";
  }
  function detect(input, name="") {
    const ext=extension(name), mapped=extMap[ext];
    if (mapped) return {format:mapped, family:textExt.has(mapped)?"text":(["image","audio","video","pdf","docx","odt","archive"].includes(mapped)?"binary-document":"text"), source:"extension", extension:ext};
    const format=sniff(input);
    return {format, family:"text", source:"content-sniff", extension:ext || null};
  }
  window.CPBInput = window.CPBInput || {};
  window.CPBInput.detectFormat=detect;
})();