import test from "node:test";
import assert from "node:assert/strict";
import { createRecoverySnapshot, readRecoverySnapshot } from "../learning/recovery-store.js";

test("recovery snapshot stores and verifies the exact source artifact",async()=>{
 const objects=new Map();
 const bucket={async put(key,value,options){objects.set(key,{value,customMetadata:options.customMetadata});},async get(key){const found=objects.get(key);return found?{text:async()=>found.value,customMetadata:found.customMetadata}:null;}};
 const record=await createRecoverySnapshot(bucket,{version:"1.0.0",commit:"abc123",files:[{path:"modules/a.js",content:"export const a=1;"}]});
 const snapshot=await readRecoverySnapshot(bucket,{key:record.key,expectedHash:record.hash});
 assert.equal(snapshot.files[0].content,"export const a=1;");
 await assert.rejects(()=>readRecoverySnapshot(bucket,{key:record.key,expectedHash:"0".repeat(64)}),/integrity/);
});
