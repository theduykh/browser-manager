import type { ScriptStep, StepType } from '../api/types';

// Not crypto.randomUUID: that requires a secure context (https/localhost) and the
// dashboard is served over plain http on the LAN. Ids are only React keys during
// editing; the backend assigns canonical ids on save.
export const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const STEP_TYPES: { value: StepType; label: string }[] = [
  { value: 'navigate', label: 'Navigate' },
  { value: 'click', label: 'Click' },
  { value: 'fill', label: 'Fill text' },
  { value: 'press', label: 'Press key' },
  { value: 'select', label: 'Select option' },
  { value: 'check', label: 'Check' },
  { value: 'uncheck', label: 'Uncheck' },
  { value: 'waitForSelector', label: 'Wait for selector' },
  { value: 'waitForTimeout', label: 'Wait (ms)' },
];

export function blankStep(type: StepType): ScriptStep {
  const base = { id: uid(), type };
  switch (type) {
    case 'navigate': return { ...base, url: '' };
    case 'fill': return { ...base, selector: '', value: '' };
    case 'select': return { ...base, selector: '', value: '' };
    case 'press': return { ...base, selector: '', key: 'Enter' };
    case 'waitForSelector': return { ...base, selector: '' };
    case 'waitForTimeout': return { ...base, ms: 1000 };
    default: return { ...base, selector: '' };
  }
}

export function stepSummary(step: ScriptStep): string {
  switch (step.type) {
    case 'navigate': return step.url || '(no url)';
    case 'fill': return `${step.selector || '(no selector)'} = ${JSON.stringify(step.value ?? '')}`;
    case 'select': return `${step.selector || '(no selector)'} → ${JSON.stringify(step.value ?? '')}`;
    case 'press': return `${step.key || '(no key)'}${step.selector ? ` on ${step.selector}` : ''}`;
    case 'waitForTimeout': return `${step.ms ?? 0} ms`;
    case 'waitForSelector': return `${step.selector || '(no selector)'}${step.timeoutMs ? ` (${step.timeoutMs}ms)` : ''}`;
    default: return step.selector || '(no selector)';
  }
}
