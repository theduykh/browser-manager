import type { ScriptStep, StepType } from '../api/types';
import { STEP_TYPES, blankStep } from '../lib/steps';

interface Props {
  steps: ScriptStep[];
  disabled?: boolean;
  onChange: (steps: ScriptStep[]) => void;
}

export function StepEditor({ steps, disabled, onChange }: Props) {
  const update = (i: number, patch: Partial<ScriptStep>) => {
    const next = steps.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const changeType = (i: number, type: StepType) => {
    const fresh = blankStep(type);
    // Carry the selector across type changes where it still applies.
    if ('selector' in fresh && steps[i].selector) fresh.selector = steps[i].selector;
    fresh.id = steps[i].id;
    const next = steps.slice();
    next[i] = fresh;
    onChange(next);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = steps.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const remove = (i: number) => onChange(steps.filter((_, k) => k !== i));
  const add = () => onChange([...steps, blankStep('click')]);

  return (
    <div className="step-editor">
      {steps.length === 0 && (
        <div className="step-empty">No steps yet. Record interactions or add a step manually.</div>
      )}

      {steps.map((step, i) => (
        <div className="step-row" key={step.id}>
          <span className="step-index">{i + 1}</span>

          <select
            className="step-type"
            value={step.type}
            disabled={disabled}
            onChange={(e) => changeType(i, e.target.value as StepType)}
          >
            {STEP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <div className="step-fields">
            <StepFields step={step} disabled={disabled} update={(patch) => update(i, patch)} />
          </div>

          <div className="step-controls">
            <button className="ghost" disabled={disabled || i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
            <button className="ghost" disabled={disabled || i === steps.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
            <button className="ghost" disabled={disabled} onClick={() => remove(i)} title="Delete step">✕</button>
          </div>
        </div>
      ))}

      <div className="step-add">
        <button disabled={disabled} onClick={add}>+ Add step</button>
      </div>
    </div>
  );
}

function StepFields({
  step, disabled, update,
}: {
  step: ScriptStep;
  disabled?: boolean;
  update: (patch: Partial<ScriptStep>) => void;
}) {
  const text = (
    field: 'url' | 'selector' | 'value' | 'key',
    placeholder: string,
  ) => (
    <input
      type="text"
      placeholder={placeholder}
      value={step[field] ?? ''}
      disabled={disabled}
      onChange={(e) => update({ [field]: e.target.value })}
    />
  );

  const num = (field: 'timeoutMs' | 'ms', placeholder: string) => (
    <input
      type="number"
      placeholder={placeholder}
      value={step[field] ?? ''}
      disabled={disabled}
      onChange={(e) => update({ [field]: e.target.value === '' ? undefined : Number(e.target.value) })}
    />
  );

  switch (step.type) {
    case 'navigate': return text('url', 'https://example.com');
    case 'click':
    case 'check':
    case 'uncheck': return text('selector', 'CSS selector');
    case 'fill': return <>{text('selector', 'CSS selector')}{text('value', 'text to type')}</>;
    case 'select': return <>{text('selector', 'select selector')}{text('value', 'option value')}</>;
    case 'press': return <>{text('selector', 'selector (optional)')}{text('key', 'key e.g. Enter')}</>;
    case 'waitForSelector': return <>{text('selector', 'CSS selector')}{num('timeoutMs', 'timeout ms (optional)')}</>;
    case 'waitForTimeout': return num('ms', 'milliseconds');
    default: return null;
  }
}
