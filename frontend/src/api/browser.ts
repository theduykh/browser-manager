import { api } from './client';
import type { AllocateResponse } from './types';

export const allocateBrowser = (profile_id?: number) =>
  api<AllocateResponse>('/api/browser/allocate', {
    method: 'POST',
    body: JSON.stringify(profile_id !== undefined ? { profile_id } : {}),
  });

export const releaseBrowser = (profile_id: number) =>
  api<{ ok: true }>('/api/browser/release', {
    method: 'POST',
    body: JSON.stringify({ profile_id }),
  });

export const heartbeat = (profile_id: number) =>
  api<{ ok: true; last_active: string }>('/api/browser/heartbeat', {
    method: 'POST',
    body: JSON.stringify({ profile_id }),
  });
