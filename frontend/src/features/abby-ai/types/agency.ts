export interface PlanStep {
  tool_name: string;
  parameters: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: Record<string, unknown>;
  error?: string;
}

export interface ActionPlan {
  plan_id: string;
  description: string;
  steps: PlanStep[];
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed' | 'cancelled';
}

export interface ExecutePlanResponse {
  plan: ActionPlan;
  message: string;
}
