/** Small D1 persistence adapter. Pass a Cloudflare D1 binding; never expose it to browser code. */
export function createD1Store(db) {
 if(!db||typeof db.prepare!=="function")throw new TypeError("A Cloudflare D1 binding is required");
 return Object.freeze({
  async saveSource(s){await db.prepare("INSERT INTO knowledge_sources(id,url,title,publisher,authority,family,retrieved_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,publisher=excluded.publisher,authority=excluded.authority,family=excluded.family,retrieved_at=excluded.retrieved_at").bind(s.id,s.url,s.title,s.publisher,s.authority,s.family,s.retrievedAt).run();},
  async saveItem(item){await db.prepare("INSERT INTO knowledge_items(id,claim,kind,confidence,evidence_state,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET claim=excluded.claim,kind=excluded.kind,confidence=excluded.confidence,evidence_state=excluded.evidence_state,updated_at=excluded.updated_at").bind(item.id,item.claim,item.kind,item.confidence,item.state,item.createdAt,item.updatedAt).run();for(const evidence of item.evidence||[])await db.prepare("INSERT OR IGNORE INTO knowledge_evidence(item_id,source_id,independent_group) VALUES(?,?,?)").bind(item.id,evidence.sourceId,evidence.independentGroup||evidence.family).run();},
  async saveAudit(record){await db.prepare("INSERT INTO update_events(run_id,event,event_at,payload_json,previous_hash,event_hash) VALUES(?,?,?,?,?,?)").bind(record.runId,record.event,record.at,JSON.stringify(record.data),record.previousHash,record.hash).run();}
 });
}
