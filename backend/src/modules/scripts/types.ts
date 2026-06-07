export type StepType =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'press'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'waitForSelector'
  | 'waitForTimeout';

interface BaseStep {
  id: string;
  type: StepType;
}

export interface NavigateStep extends BaseStep { type: 'navigate'; url: string; }
export interface ClickStep extends BaseStep { type: 'click'; selector: string; }
export interface FillStep extends BaseStep { type: 'fill'; selector: string; value: string; }
export interface PressStep extends BaseStep { type: 'press'; selector?: string; key: string; }
export interface SelectStep extends BaseStep { type: 'select'; selector: string; value: string; }
export interface CheckStep extends BaseStep { type: 'check'; selector: string; }
export interface UncheckStep extends BaseStep { type: 'uncheck'; selector: string; }
export interface WaitForSelectorStep extends BaseStep { type: 'waitForSelector'; selector: string; timeoutMs?: number; }
export interface WaitForTimeoutStep extends BaseStep { type: 'waitForTimeout'; ms: number; }

export type ScriptStep =
  | NavigateStep
  | ClickStep
  | FillStep
  | PressStep
  | SelectStep
  | CheckStep
  | UncheckStep
  | WaitForSelectorStep
  | WaitForTimeoutStep;

export interface ScriptRow {
  id: number;
  name: string;
  description: string;
  steps: string;
  created_at: string;
  updated_at: string;
}

export interface ScriptRunSummary {
  status: RunStatus;
  started_at: string;
  finished_at: string;
}

export interface Script extends Omit<ScriptRow, 'steps'> {
  steps: ScriptStep[];
  last_run: ScriptRunSummary | null;
}

export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type TargetStatus = 'pending' | 'allocating' | 'running' | 'passed' | 'failed';
export type RunStatus = 'running' | 'passed' | 'failed' | 'partial';

export interface StepResult {
  stepId: string;
  type: StepType;
  status: StepStatus;
  error?: string;
  durationMs?: number;
}

export interface TargetResult {
  profileId: number;
  profileName: string;
  status: TargetStatus;
  allocated: boolean;
  steps: StepResult[];
  error?: string;
  screenshot?: string;
}

export interface RunReport {
  runId: string;
  scriptId: number;
  scriptName: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  targets: TargetResult[];
}

export interface ScriptRunRow {
  id: number;
  script_id: number;
  status: string;
  report: string;
  started_at: string;
  finished_at: string;
}

export interface RecordingState {
  recordingId: string;
  profileId: number;
  profileName: string;
  status: 'recording' | 'stopped' | 'error';
  steps: ScriptStep[];
  error?: string;
}
