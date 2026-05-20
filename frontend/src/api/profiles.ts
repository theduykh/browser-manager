import { api } from './client';
import type { Profile, ProfileConfigInput } from './types';

export const listProfiles = () => api<Profile[]>('/api/profiles');

export const createProfile = (input: { profile_name: string } & ProfileConfigInput) =>
  api<Profile>('/api/profiles', { method: 'POST', body: JSON.stringify(input) });

export const deleteProfile = (id: number) =>
  api<void>(`/api/profiles/${id}`, { method: 'DELETE' });

export const resetProfile = (id: number) =>
  api<Profile>(`/api/profiles/${id}/reset`, { method: 'POST' });

export const updateProfile = (id: number, patch: ProfileConfigInput) =>
  api<Profile>(`/api/profiles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
