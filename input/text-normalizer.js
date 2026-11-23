/* Conservative text decoding and normalization. Original text is retained. */
(() => {
  function decode(buffer) {
    const bytes=new Uint8Array(buffer);
    let encoding="utf-8", offset=0, decoder;
    if (bytes.length>=3 && bytes[0]===0xEF && bytes[1]===0xBB && bytes[2]===0xBF) offset=3;
    else if (bytes.length>=2 && bytes[0]===0xFF && bytes[1]===0xFE) { encoding="utf-16le"; offset=2; }
    else if (bytes.length>=2 && bytes[0]===0xFE && bytes[1]===0xFF) { encoding="utf-16be"; offset=2; }
    try { decoder=new TextDecoder(encoding,{fatal:false}); }
    catch { encoding="utf-8"; decoder=new TextDecoder("utf-8",{fatal:false}); offset=0; }
    const text=decoder.decode(bytes.subarray(offset));
    const replacementCount=(text.match(/\uFFFD/g)||[]).length;
    return {text,encoding,replacementCount,hadBom:offset>0};
  }
  function normalize(text) {
    const original=String(text);
    const normalized=original.replace(/\r\n?/g,"\n").replace(/\u0000/g,"").normalize("NFC");
    return {original,normalized,changed:original!==normalized,unicodeForm:"NFC"};
  }
  window.CPBInput=window.CPBInput||{};
  window.CPBInput.decodeBuffer=decode;
  window.CPBInput.normalizeText=normalize;
})();