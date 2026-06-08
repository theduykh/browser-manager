import { api } from './client';
import type { Capacity } from './types';

export const getCapacity = () => api<Capacity>('/api/capacity');
