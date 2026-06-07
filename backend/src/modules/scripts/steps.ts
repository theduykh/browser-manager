import { randomUUID } from 'crypto';
import { ScriptStep, StepType } from './types';

export class InvalidScriptError extends Error { code = 'INVALID_SCRIPT' as const; }

const MAX_STEPS = 1000;
const STR_MAX = 8000;
const MAX_TIMEOUT_MS = 600_000;

const STEP_TYPES: ReadonlySet<string> = new Set<StepType>([
  'navigate', 'click', 'fill', 'press', 'select', 'check', 'uncheck',
  'waitForSelector', 'waitForTimeout',
]);

function reqStr(obj: Record<string, unknown>, field: string): string {
  const v = obj[field];
  if (typeof v !== 'string' || v.length === 0) throw new InvalidScriptError(`step.${field} must be a non-empty string`);
  if (v.length > STR_MAX) throw new InvalidScriptError(`step.${field} too long (>${STR_MAX} chars)`);
  return v;
}

function optStr(obj: Record<string, unknown>, field: string): string | undefined {
  const v = obj[field];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') throw new InvalidScriptError(`step.${field} must be a string`);
  if (v.length > STR_MAX) throw new InvalidScriptError(`step.${field} too long (>${STR_MAX} chars)`);
  return v;
}

function intInRange(obj: Record<string, unknown>, field: string, min: number, max: number): number {
  const v = obj[field];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    throw new InvalidScriptError(`step.${field} must be an integer in [${min},${max}]`);
  return v;
}

// "fill" value may legitimately be empty (clearing a field), so allow empty strings.
function fillValue(obj: Record<string, unknown>): string {
  const v = obj.value;
  if (typeof v !== 'string') throw new InvalidScriptError('step.value must be a string');
  if (v.length > STR_MAX) throw new InvalidScriptError(`step.value too long (>${STR_MAX} chars)`);
  return v;
}

export function validateSteps(raw: unknown): ScriptStep[] {
  if (!Array.isArray(raw)) throw new InvalidScriptError('steps must be an array');
  if (raw.length > MAX_STEPS) throw new InvalidScriptError(`too many steps (>${MAX_STEPS})`);

  return raw.map((item, i): ScriptStep => {
    if (item === null || typeof item !== 'object' || Array.isArray(item))
      throw new InvalidScriptError(`steps[${i}] must be an object`);
    const o = item as Record<string, unknown>;
    const type = o.type;
    if (typeof type !== 'string' || !STEP_TYPES.has(type))
      throw new InvalidScriptError(`steps[${i}].type is invalid: ${String(type)}`);

    const id = typeof o.id === 'string' && o.id.length > 0 ? o.id : randomUUID();

    switch (type as StepType) {
      case 'navigate':        return { id, type: 'navigate', url: reqStr(o, 'url') };
      case 'click':           return { id, type: 'click', selector: reqStr(o, 'selector') };
      case 'fill':            return { id, type: 'fill', selector: reqStr(o, 'selector'), value: fillValue(o) };
      case 'press':           return { id, type: 'press', selector: optStr(o, 'selector'), key: reqStr(o, 'key') };
      case 'select':          return { id, type: 'select', selector: reqStr(o, 'selector'), value: fillValue(o) };
      case 'check':           return { id, type: 'check', selector: reqStr(o, 'selector') };
      case 'uncheck':         return { id, type: 'uncheck', selector: reqStr(o, 'selector') };
      case 'waitForSelector': {
        const selector = reqStr(o, 'selector');
        const timeoutMs = o.timeoutMs === undefined ? undefined : intInRange(o, 'timeoutMs', 0, MAX_TIMEOUT_MS);
        return { id, type: 'waitForSelector', selector, ...(timeoutMs !== undefined ? { timeoutMs } : {}) };
      }
      case 'waitForTimeout':  return { id, type: 'waitForTimeout', ms: intInRange(o, 'ms', 0, MAX_TIMEOUT_MS) };
    }
  });
}
