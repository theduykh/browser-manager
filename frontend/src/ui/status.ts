import type { ProfileStatus } from '../api/types';

// The DB persists IDLE | IN_USE | CORRUPT. ALLOCATING is a UI-only transient state
// derived from a pending allocate mutation (it is never returned by the backend).
export type UiStatus = ProfileStatus | 'ALLOCATING';

export interface StatusMeta {
  label: string;
  color: string;
  text: string;
  tint: string;
  line: string;
}

export const STATUS: Record<UiStatus, StatusMeta> = {
  IDLE:       { label: 'Idle',       color: 'var(--c-idle)',    text: 'var(--text-2)',       tint: 'var(--idle-tint)',    line: 'var(--idle-line)' },
  IN_USE:     { label: 'In use',     color: 'var(--c-inuse)',   text: 'var(--inuse-text)',   tint: 'var(--inuse-tint)',   line: 'var(--inuse-line)' },
  CORRUPT:    { label: 'Corrupt',    color: 'var(--c-corrupt)', text: 'var(--corrupt-text)', tint: 'var(--corrupt-tint)', line: 'var(--corrupt-line)' },
  ALLOCATING: { label: 'Allocating', color: 'var(--c-alloc)',   text: 'var(--alloc-text)',   tint: 'var(--alloc-tint)',   line: 'var(--alloc-line)' },
};
