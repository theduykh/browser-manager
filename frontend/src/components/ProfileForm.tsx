import { useEffect, useState } from 'react';
import type { ProfileConfigInput } from '../api/types';

export interface ProfileFormValues {
  profile_name: string;
  window_width: number;
  window_height: number;
  launch_args: string;
  note: string;
}

export const DEFAULT_VALUES: ProfileFormValues = {
  profile_name: '',
  window_width: 1920,
  window_height: 1080,
  launch_args: '',
  note: '',
};

interface Props {
  initial: ProfileFormValues;
  busy: boolean;
  lockName?: boolean;            // disable name editing (when profile is IN_USE)
  saveLabel?: string;
  onSubmit: (values: ProfileFormValues, changed: ProfileConfigInput) => void;
  onCancel?: () => void;
  showNameField?: boolean;       // hide name field in some contexts
}

const NAME_RE = /^[A-Za-z0-9._@-]{1,64}$/;

function isValidName(name: string): boolean {
  const trimmed = name.trim();
  if (!NAME_RE.test(trimmed)) return false;
  if (trimmed === '.' || trimmed === '..') return false;
  if (trimmed.startsWith('.') || trimmed.endsWith('.')) return false;
  return true;
}

export function ProfileForm({
  initial, busy, lockName, saveLabel = 'Save', onSubmit, onCancel, showNameField = true,
}: Props) {
  const [v, setV] = useState<ProfileFormValues>(initial);

  useEffect(() => { setV(initial); }, [
    initial.profile_name, initial.window_width, initial.window_height,
    initial.launch_args, initial.note,
  ]);

  const set = <K extends keyof ProfileFormValues>(k: K, val: ProfileFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const dirtyFields: (keyof ProfileFormValues)[] = (Object.keys(initial) as (keyof ProfileFormValues)[])
    .filter((k) => v[k] !== initial[k]);

  const nameValid = isValidName(v.profile_name);
  const dimsValid =
    Number.isInteger(v.window_width)  && v.window_width  >= 320 && v.window_width  <= 7680 &&
    Number.isInteger(v.window_height) && v.window_height >= 320 && v.window_height <= 7680;

  const canSave = !busy && dirtyFields.length > 0 && nameValid && dimsValid;

  const submit = () => {
    if (!canSave) return;
    const changed: ProfileConfigInput = {};
    for (const k of dirtyFields) (changed as any)[k] = (v as any)[k];
    onSubmit(v, changed);
  };

  return (
    <div>
      {showNameField && (
        <div className="form-row">
          <label>Name</label>
          <input
            type="text"
            value={v.profile_name}
            disabled={busy || lockName}
            onChange={(e) => set('profile_name', e.target.value)}
            placeholder="A-Z, 0-9, . _ - @  (e.g. user@example.com)"
          />
          {!nameValid && v.profile_name.length > 0 && (
            <div className="field-hint error">Invalid characters or length.</div>
          )}
          {lockName && (
            <div className="field-hint">Release the profile before renaming.</div>
          )}
        </div>
      )}

      <div className="form-row">
        <label>Window size (px)</label>
        <div className="dim-pair">
          <input
            type="number"
            min={320} max={7680}
            value={v.window_width}
            disabled={busy}
            onChange={(e) => set('window_width', Number(e.target.value))}
          />
          <span>×</span>
          <input
            type="number"
            min={320} max={7680}
            value={v.window_height}
            disabled={busy}
            onChange={(e) => set('window_height', Number(e.target.value))}
          />
        </div>
        {!dimsValid && (
          <div className="field-hint error">Both dimensions must be 320–7680.</div>
        )}
        <div className="field-hint">Applies on next allocate. Xvfb screen + Chromium window both use this size.</div>
      </div>

      <div className="form-row">
        <label>Launch arguments</label>
        <textarea
          value={v.launch_args}
          disabled={busy}
          rows={3}
          maxLength={4000}
          placeholder="e.g. --disable-web-security --lang=en-US"
          onChange={(e) => set('launch_args', e.target.value)}
        />
        <div className="field-hint">
          Whitespace-separated; appended after defaults. Quoted args not supported. Takes effect on next allocate.
        </div>
      </div>

      <div className="form-row">
        <label>Note</label>
        <textarea
          value={v.note}
          disabled={busy}
          rows={3}
          maxLength={2000}
          placeholder="Anything you want to remember about this profile."
          onChange={(e) => set('note', e.target.value)}
        />
      </div>

      <div className="form-actions">
        {onCancel && (
          <button className="ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        )}
        <button className="primary" onClick={submit} disabled={!canSave}>
          {busy ? '…' : saveLabel}
        </button>
      </div>
    </div>
  );
}
