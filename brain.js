/* CPB-01: deterministic symbolic brain kernel. No LLM, AI API, or network calls. */
(() => {
  const STORAGE_KEY = "cpb01-memory-v1";
  const clean = s => s.normalize("NFC").toLocaleLowerCase("vi").replace(/[!?.,;:]+$/g,"").trim();
  const memory = {
    facts: [],
    rules: [
      {type:"transitive", label:"transitive relation"}
    ],
    turns: 0,
    load() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        this.facts = Array.isArray(saved.facts) ? saved.facts : [];
        this.turns = Number(saved.turns) || 0;
      } catch { this.facts = []; this.turns = 0; }
    },
    save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({facts:this.facts, turns:this.turns}));
    },
    add(subject, relation, object) {
      const fact = {subject:subject.trim(), relation:relation.trim(), object:object.trim(), created:Date.now()};
      const key = [clean(fact.subject),clean(fact.relation),clean(fact.object)].join("|");
      if (!this.facts.some(f => [clean(f.subject),clean(f.relation),clean(f.object)].join("|") === key)) this.facts.push(fact);
      this.save();
      return fact;
    }
  };
  memory.load();

  function answer(input) {
    const raw = input.trim();
    const q = clean(raw);
    memory.turns++;
    if (!q) return "Bạn chưa nhập nội dung.";
    if (/^(xin chao|chao|hello|hi|hey)(\s|$)/.test(q)) return "Chào bạn. Tôi là CPB-01, một chương trình suy luận ký hiệu chạy trực tiếp trong trình duyệt. Tôi không sử dụng mô hình AI.";
    if (/(ban la ai|may la ai|ten gi|gioi thieu)/.test(q)) return "Tôi là CPB-01. Lõi hiện tại gồm bộ phân tích mẫu câu, bộ nhớ sự kiện, truy vấn và một số quy tắc suy luận xác định. Tôi không phải mô hình ngôn ngữ và không giả vờ hiểu điều chưa được lập trình.";
    if (/(ban co nho|nho gi|bo nho|memory)/.test(q)) {
      if (!memory.facts.length) return "Bộ nhớ hiện chưa có sự kiện nào. Bạn có thể dạy tôi bằng câu: “ghi nhớ: Trái Đất | là | hành tinh”.";
      return "Bộ nhớ hiện có " + memory.facts.length + " sự kiện:\n" + memory.facts.map((f,i)=>(i+1)+". "+f.subject+" — "+f.relation+" — "+f.object).join("\n");
    }
    if (/^(xoa bo nho|quên tất cả|clear memory)$/.test(q)) {
      memory.facts = []; memory.save(); return "Đã xóa bộ nhớ sự kiện cục bộ của CPB-01.";
    }
    const teach = raw.match(/^(?:ghi nhớ|ghi nho|hãy nhớ|hay nho)\s*:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)$/i);
    if (teach) {
      const f = memory.add(teach[1],teach[2],teach[3]);
      return "Đã lưu một sự kiện vào bộ nhớ:\n"+f.subject+" — "+f.relation+" — "+f.object+"\nTôi chỉ lưu dữ kiện; việc lưu không tự chứng minh dữ kiện đó đúng.";
    }
    const arithmetic = q.match(/^(?:tinh|calculate)\s+(-?\d+(?:\.\d+)?)\s*([+*/-])\s*(-?\d+(?:\.\d+)?)$/);
    if (arithmetic) {
      const a=Number(arithmetic[1]), b=Number(arithmetic[3]), op=arithmetic[2];
      if (op==="/" && b===0) return "Phép chia cho 0 không xác định.";
      const result = op==="+"?a+b:op==="-"?a-b:op==="*"?a*b:a/b;
      return "Kết quả tính toán: "+result;
    }
    const ask = raw.match(/^(?:.+?)\s+(?:là gì|la gi|là ai|la ai)\??$/i);
    if (ask) {
      const subject=clean(raw.replace(/\s+(là gì|la gi|là ai|la ai)\??$/i,""));
      const found=memory.facts.filter(f=>clean(f.subject)===subject);
      if (found.length) return found.map(f=>f.subject+" "+f.relation+" "+f.object+".").join("\n");
      return "Tôi chưa có dữ kiện về “"+raw.replace(/\s+(là gì|la gi|là ai)\??$/i,"")+"”. Bạn có thể cung cấp một sự kiện để tôi lưu. Tôi sẽ không tự bịa câu trả lời.";
    }
    const query = raw.match(/^(.+?)\s+(?:có quan hệ gì với|la|là)\s+(.+?)\??$/i);
    if (query) {
      const s=clean(query[1]), o=clean(query[2]);
      const found=memory.facts.filter(f=>clean(f.subject)===s && clean(f.object)===o);
      if (found.length) return "Tôi tìm thấy trong bộ nhớ: "+found.map(f=>f.subject+" "+f.relation+" "+f.object).join("; ")+".";
    }
    if (/^(cam on|cảm ơn|thanks)/.test(q)) return "Đã nhận. Tôi đã xử lý lượt tương tác này.";
    return "Tôi chưa có quy tắc hoặc dữ kiện đủ để trả lời câu này.\n\nCPB-01 hiện chỉ xử lý các thao tác đã được lập trình: chào hỏi, lưu sự kiện, truy vấn bộ nhớ, xem bộ nhớ và tính toán đơn giản. Đây là giới hạn thật của phiên bản đầu, không phải câu trả lời do AI tạo ra.";
  }

  window.CPB01 = {
    respond(text) { const result=answer(text); memory.save(); return {text:result, turns:memory.turns, facts:memory.facts.length, engine:"symbolic-kernel"}; },
    stats() { return {turns:memory.turns, facts:memory.facts.length}; },
    clear() { memory.facts=[]; memory.turns=0; memory.save(); }
  };
})();