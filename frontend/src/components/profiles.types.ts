import type { Profile } from '../api/types';

export type ProfileAction = 'allocate' | 'release' | 'reset' | 'delete';
export type SortKey = 'status' | 'name' | 'group' | 'lastUsed' | 'slot';
export type SortDir = 'asc' | 'desc';
export interface Sort { key: SortKey; dir: SortDir; }
export type StatusFilter = 'all' | 'IN_USE' | 'IDLE' | 'CORRUPT';
export type GroupFilter = 'all' | 'ungrouped' | number;
export type Density = 'comfortable' | 'compact';
export type ViewMode = 'grid' | 'table';

export type GroupNameFn = (id: number | null) => string;
export type OpenFn = (id: number) => void;
export type ActionFn = (action: ProfileAction, p: Profile) => void;
