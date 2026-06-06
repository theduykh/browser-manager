import { api } from './client';
import type { Group } from './types';

export const listGroups = () => api<Group[]>('/api/groups');

export const createGroup = (name: string) =>
  api<Group>('/api/groups', { method: 'POST', body: JSON.stringify({ name }) });

export const renameGroup = (id: number, name: string) =>
  api<Group>(`/api/groups/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) });

export const deleteGroup = (id: number) =>
  api<void>(`/api/groups/${id}`, { method: 'DELETE' });
