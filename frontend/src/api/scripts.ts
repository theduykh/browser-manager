import { api } from './client';
import type { Script, ScriptStep, RunReport, Recording } from './types';

export const listScripts = () => api<Script[]>('/api/scripts');

export const getScript = (id: number) => api<Script>(`/api/scripts/${id}`);

export const createScript = (input: { name: string; description?: string; steps?: ScriptStep[] }) =>
  api<Script>('/api/scripts', { method: 'POST', body: JSON.stringify(input) });

export const updateScript = (
  id: number,
  patch: { name?: string; description?: string; steps?: ScriptStep[] },
) => api<Script>(`/api/scripts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const deleteScript = (id: number) =>
  api<void>(`/api/scripts/${id}`, { method: 'DELETE' });

export interface RunInput {
  targets: number[];
  autoAllocate: boolean;
  stopOnError: boolean;
}

export const runScript = (id: number, input: RunInput) =>
  api<{ run_id: string }>(`/api/scripts/${id}/run`, { method: 'POST', body: JSON.stringify(input) });

export const getRun = (runId: string) => api<RunReport>(`/api/scripts/runs/${runId}`);

export const getReport = (id: number) => api<RunReport | null>(`/api/scripts/${id}/report`);

export const startRecording = (profile_id: number) =>
  api<{ recording_id: string }>('/api/scripts/record/start', {
    method: 'POST',
    body: JSON.stringify({ profile_id }),
  });

export const getRecording = (recordingId: string) =>
  api<Recording>(`/api/scripts/record/${recordingId}`);

export const stopRecording = (recordingId: string) =>
  api<{ steps: ScriptStep[] }>(`/api/scripts/record/${recordingId}/stop`, { method: 'POST' });
