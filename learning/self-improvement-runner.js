/**
 * Orchestrates a bounded update lifecycle through injected adapters.
 * Adapters must run tests in an isolated CI environment and persist logs externally.
 */
import { assessChangeSet, evaluateUpdate } from "../self-improvement-governance.js";
export class SelfImprovementRunner {
  constructor({research,propose,apply,validate,activate,rollback,audit,policy}={}) {
    for(const [name,fn] of Object.entries({research,propose,apply,validate,activate,rollback,audit}))
      if(typeof fn!=="function")throw new TypeError(`Missing adapter: ${name}`);
    Object.assign(this,{research,propose,apply,validate,activate,rollback,audit,policy});
    this.running=false;
  }
  async run({topic,baseline,signal}={}) {
    if(this.running)throw new Error("An improvement run is already active");
    this.running=true;
    const runId=`cpb-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    let applied=null,activated=false;
    const log=async(event,data={})=>this.audit({runId,event,at:new Date().toISOString(),data});
    try {
      await log("STARTED",{topic,baseline});
      const findings=await this.research({topic,signal});
      await log("RESEARCH_COMPLETED",{findingCount:Array.isArray(findings)?findings.length:0});
      const proposal=await this.propose({topic,findings,baseline,signal});
      const gate=assessChangeSet(proposal?.paths||[],this.policy);
      await log("CHANGESET_ASSESSED",gate);
      if(!gate.allowed)throw new Error("Change set rejected: "+gate.reason);
      applied=await this.apply({proposal,runId,signal});
      await log("CANDIDATE_CREATED",{commit:applied?.commit,paths:proposal.paths});
      const report=await this.validate({candidate:applied,baseline,signal});
      const evaluation=evaluateUpdate(report,baseline);
      await log("EVALUATION_COMPLETED",{evaluation,report});
      if(!evaluation.accepted)throw new Error("Candidate rejected: "+evaluation.failedChecks.join(", "));
      await log("ACTIVATION_APPROVED",{commit:applied?.commit});
      await this.activate({candidate:applied,runId,signal});
      await log("ACTIVATED",{commit:applied?.commit});
      activated=true;
      return {runId,status:"ACTIVATED",evaluation,commit:applied?.commit};
    } catch(error) {
      try { await log("FAILED",{message:String(error?.message||error),commit:applied?.commit}); } catch {}
      if(applied&&!activated) {
        try {
          const recovery=await this.rollback({candidate:applied,runId});
          try { await log("RECOVERY_COMPLETED",{recovery}); } catch {}
        } catch(recoveryError) {
          try { await log("RECOVERY_FAILED",{message:String(recoveryError?.message||recoveryError)}); } catch {}
          throw new AggregateError([error,recoveryError],"Update and recovery both failed");
        }
      }
      throw error;
    } finally {this.running=false;}
  }
}
