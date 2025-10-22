import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

interface ProgressStageInput {
  projectId: string;
  targetStage: string;
  skipGates?: boolean;
}

interface ApprovalPayload {
  approved: boolean;
  approver: string;
  reason?: string;
  timestamp: number;
}

const STAGE_GATES = {
  '01-scoped': {
    automated: ['has_readme', 'has_plan'],
    human: true,
    approver_role: 'tech_lead'
  },
  '02-active': {
    automated: ['plan_approved'],
    human: false
  },
  '03-review': {
    automated: ['tests_pass', 'lint_clean', 'no_conflicts'],
    human: false
  },
  '04-complete': {
    automated: ['all_tests_pass', 'docs_updated'],
    human: true,
    approver_role: 'senior_dev'
  }
};

export class ProgressStageWorkflow extends WorkflowEntrypoint<Env, ProgressStageInput> {
  async run(event: WorkflowEvent<ProgressStageInput>, step: WorkflowStep) {
    const { projectId, targetStage, skipGates } = event.payload;

    // Step 1: Load current project state
    const project = await step.do('load-project', async () => {
      const id = this.env.PIPELINE_STATE.idFromName(projectId);
      const obj = this.env.PIPELINE_STATE.get(id);
      const response = await obj.fetch('http://internal/get');
      return await response.json();
    });

    const currentStage = project.current_stage;

    // Step 2: Run automated gate checks (unless skipped)
    if (!skipGates && STAGE_GATES[targetStage]) {
      const gateResults = await step.do('gate-checks', async () => {
        const gates = STAGE_GATES[targetStage];
        const results = [];

        for (const gateName of gates.automated || []) {
          const result = await this.runGateCheck(projectId, gateName);
          results.push({ gate: gateName, passed: result.passed, details: result.details });
        }

        const allPassed = results.every(r => r.passed);
        return { allPassed, results };
      });

      if (!gateResults.allPassed) {
        return {
          success: false,
          error: 'Gate checks failed',
          failures: gateResults.results.filter(r => !r.passed),
          stage: currentStage
        };
      }
    }

    // Step 3: Human approval (if required)
    const requiresApproval = STAGE_GATES[targetStage]?.human;

    if (requiresApproval && !skipGates) {
      // Send approval notification
      await step.do('notify-approver', async () => {
        // TODO: Send email/Slack notification
        console.log(`Approval required for ${projectId} to progress to ${targetStage}`);
        return true;
      });

      // Pause workflow and wait for human approval
      const approval = await step.do('await-approval', async () => {
        // This pauses the workflow until resumed via API
        return await this.pause<ApprovalPayload>('approval-required');
      });

      if (!approval.approved) {
        return {
          success: false,
          error: 'Approval denied',
          reason: approval.reason,
          stage: currentStage
        };
      }

      // Record approval
      await step.do('record-approval', async () => {
        const id = this.env.PIPELINE_STATE.idFromName(projectId);
        const obj = this.env.PIPELINE_STATE.get(id);

        await obj.fetch('http://internal/history', {
          method: 'POST',
          body: JSON.stringify({
            event: 'approved',
            stage: targetStage,
            approver: approval.approver,
            timestamp: approval.timestamp
          })
        });

        return true;
      });
    }

    // Step 4: Move project to new stage
    await step.do('move-stage', async () => {
      const id = this.env.PIPELINE_STATE.idFromName(projectId);
      const obj = this.env.PIPELINE_STATE.get(id);

      await obj.fetch('http://internal/update', {
        method: 'POST',
        body: JSON.stringify({
          current_stage: targetStage,
          previous_stage: currentStage,
          updated_at: Date.now()
        })
      });

      return true;
    });

    // Step 5: Run post-progression hooks
    await step.do('post-hooks', async () => {
      // Run any stage-specific setup
      if (targetStage === '02-active') {
        // Set up development environment
        console.log(`Setting up dev environment for ${projectId}`);
      } else if (targetStage === '04-complete') {
        // Archive and prepare for deployment
        console.log(`Archiving ${projectId}`);
      }
      return true;
    });

    // Step 6: Record stage transition in history
    await step.do('record-transition', async () => {
      const id = this.env.PIPELINE_STATE.idFromName(projectId);
      const obj = this.env.PIPELINE_STATE.get(id);

      await obj.fetch('http://internal/history', {
        method: 'POST',
        body: JSON.stringify({
          event: 'stage_transition',
          from_stage: currentStage,
          to_stage: targetStage,
          timestamp: Date.now()
        })
      });

      return true;
    });

    return {
      success: true,
      projectId,
      previous_stage: currentStage,
      current_stage: targetStage,
      message: `Project progressed from ${currentStage} to ${targetStage}`
    };
  }

  private async runGateCheck(projectId: string, gateName: string) {
    // Gate check implementations
    const checks = {
      has_readme: async () => {
        const id = this.env.PROJECT_STORAGE.idFromName(projectId);
        const obj = this.env.PROJECT_STORAGE.get(id);
        const response = await obj.fetch(`http://internal/exists?file=README.md`);
        return await response.json();
      },
      has_plan: async () => {
        const id = this.env.PROJECT_STORAGE.idFromName(projectId);
        const obj = this.env.PROJECT_STORAGE.get(id);
        const response = await obj.fetch(`http://internal/exists?file=PLAN.md`);
        return await response.json();
      },
      plan_approved: async () => {
        const id = this.env.PIPELINE_STATE.idFromName(projectId);
        const obj = this.env.PIPELINE_STATE.get(id);
        const response = await obj.fetch('http://internal/get');
        const project = await response.json();
        return { passed: project.metadata?.plan_approved === true };
      },
      tests_pass: async () => {
        // TODO: Trigger test runner
        return { passed: true, details: 'Tests not yet implemented' };
      },
      lint_clean: async () => {
        // TODO: Trigger linter
        return { passed: true, details: 'Linter not yet implemented' };
      },
      no_conflicts: async () => {
        // TODO: Check git status
        return { passed: true, details: 'Conflict check not yet implemented' };
      },
      all_tests_pass: async () => {
        // TODO: Full test suite
        return { passed: true, details: 'Full test suite not yet implemented' };
      },
      docs_updated: async () => {
        const id = this.env.PROJECT_STORAGE.idFromName(projectId);
        const obj = this.env.PROJECT_STORAGE.get(id);
        const response = await obj.fetch(`http://internal/exists?file=DOCS.md`);
        return await response.json();
      }
    };

    if (checks[gateName]) {
      return await checks[gateName]();
    }

    return { passed: false, details: `Unknown gate: ${gateName}` };
  }
}
