export type ProfileStatus = 'IDLE' | 'IN_USE' | 'CORRUPT';

export interface LaunchConfig {
  lang?: string;
  proxy?: string;
  disableWebSecurity?: boolean;
  disableExtensions?: boolean;
  muteAudio?: boolean;
  ignoreCertErrors?: boolean;
  disableNotifications?: boolean;
  disablePopupBlocking?: boolean;
}

export interface Group {
  id: number;
  name: string;
  created_at: string;
  profile_count: number;
}

export interface Profile {
  id: number;
  profile_name: string;
  folder_path: string;
  status: ProfileStatus;
  slot_id: number | null;
  ws_port: number | null;
  cdp_port: number | null;
  pids: number[] | null;
  allocated_at: string | null;
  last_active: string;
  window_width: number;
  window_height: number;
  launch_args: string;
  note: string;
  launch_config: string;
  group_id: number | null;
  tags: string[];
}

export interface ProfileConfigInput {
  profile_name?: string;
  window_width?: number;
  window_height?: number;
  launch_args?: string;
  note?: string;
  launch_config?: LaunchConfig;
  group_id?: number | null;
  tags?: string[];
}

export interface AllocateResponse {
  profile_id: number;
  slot_id: number;
  ws_port: number;
  cdp_port: number;
  cdp_endpoint: string;
  ws_url: string;
}

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

// Flat shape (superset of the backend's per-type fields) for ease of editing.
// The backend validates and keeps only the fields relevant to each type on save.
export interface ScriptStep {
  id: string;
  type: StepType;
  url?: string;
  selector?: string;
  value?: string;
  key?: string;
  timeoutMs?: number;
  ms?: number;
}

export type RunStatus = 'running' | 'passed' | 'failed' | 'partial';
export type StepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
export type TargetStatus = 'pending' | 'allocating' | 'running' | 'passed' | 'failed';

export interface ScriptRunSummary {
  status: RunStatus;
  started_at: string;
  finished_at: string;
}

export interface Script {
  id: number;
  name: string;
  description: string;
  steps: ScriptStep[];
  created_at: string;
  updated_at: string;
  last_run: ScriptRunSummary | null;
}

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

export interface Recording {
  recordingId: string;
  profileId: number;
  profileName: string;
  status: 'recording' | 'stopped' | 'error';
  steps: ScriptStep[];
  error?: string;
}
