import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { Group, LaunchConfig, ProfileConfigInput } from '../api/types';
import { TagInput } from './TagInput';

export interface ProfileFormValues {
  profile_name: string;
  window_width: number;
  window_height: number;
  launch_args: string;
  note: string;
  launch_config: LaunchConfig;
  group_id: number | null;
  tags: string[];
}

export const DEFAULT_VALUES: ProfileFormValues = {
  profile_name: '',
  window_width: 1920,
  window_height: 1080,
  launch_args: '',
  note: '',
  launch_config: {},
  group_id: null,
  tags: [],
};

interface Props {
  initial: ProfileFormValues;
  busy: boolean;
  groups: Group[];
  tagSuggestions?: string[];
  lockName?: boolean;            // disable name editing (when profile is IN_USE)
  saveLabel?: string;
  onSubmit: (values: ProfileFormValues, changed: ProfileConfigInput) => void;
  onCancel?: () => void;
  showNameField?: boolean;       // hide name field in some contexts
  twoCol?: boolean;              // lay short fields out in 2 columns (wide detail panel)
  hideActions?: boolean;         // hide the built-in Save/Cancel bar (parent renders its own)
  onCanSaveChange?: (canSave: boolean) => void;
}

export interface ProfileFormHandle {
  submit: () => void;
}

const WINDOW_PRESETS = [
  { label: '1920 × 1080 — Full HD',  w: 1920, h: 1080 },
  { label: '1440 × 900',             w: 1440, h: 900  },
  { label: '1366 × 768',             w: 1366, h: 768  },
  { label: '1280 × 720 — HD',        w: 1280, h: 720  },
  { label: '2560 × 1440 — 2K',       w: 2560, h: 1440 },
  { label: '3840 × 2160 — 4K',       w: 3840, h: 2160 },
  { label: 'Custom',                 w: 0,    h: 0    },
] as const;

const LANG_OPTIONS = [
  { label: 'System default', value: '' },
  { label: 'English (US)',   value: 'en-US' },
  { label: 'Vietnamese',     value: 'vi-VN' },
  { label: 'Japanese',       value: 'ja-JP' },
  { label: 'Chinese (CN)',   value: 'zh-CN' },
  { label: 'Korean',         value: 'ko-KR' },
  { label: 'French',         value: 'fr-FR' },
  { label: 'German',         value: 'de-DE' },
  { label: 'Spanish',        value: 'es-ES' },
  { label: 'Portuguese (BR)',value: 'pt-BR' },
] as const;

const BOOL_TOGGLES: Array<{ key: keyof LaunchConfig; label: string }> = [
  { key: 'disableWebSecurity',   label: 'Disable web security' },
  { key: 'disableExtensions',    label: 'Disable extensions' },
  { key: 'muteAudio',            label: 'Mute audio' },
  { key: 'ignoreCertErrors',     label: 'Ignore certificate errors' },
  { key: 'disableNotifications', label: 'Disable notifications' },
  { key: 'disablePopupBlocking', label: 'Disable popup blocking' },
];

const NAME_RE = /^[A-Za-z0-9._@-]{1,64}$/;

function isValidName(name: string): boolean {
  const trimmed = name.trim();
  if (!NAME_RE.test(trimmed)) return false;
  if (trimmed === '.' || trimmed === '..') return false;
  if (trimmed.startsWith('.') || trimmed.endsWith('.')) return false;
  return true;
}

function detectPreset(w: number, h: number): string {
  return WINDOW_PRESETS.find((p) => p.w === w && p.h === h && p.w !== 0)?.label ?? 'Custom';
}

export const ProfileForm = forwardRef<ProfileFormHandle, Props>(function ProfileForm({
  initial, busy, groups, tagSuggestions, lockName, saveLabel = 'Save',
  onSubmit, onCancel, showNameField = true, twoCol = false, hideActions = false, onCanSaveChange,
}, ref) {
  const [v, setV] = useState<ProfileFormValues>(initial);
  // 'Custom' is a user intent, not derivable from dimensions alone: 1920×1080 matches a
  // preset yet the user may still want manual entry. Track it as explicit state.
  const [customSize, setCustomSize] = useState(
    () => detectPreset(initial.window_width, initial.window_height) === 'Custom',
  );

  useEffect(() => {
    setV(initial);
    setCustomSize(detectPreset(initial.window_width, initial.window_height) === 'Custom');
  }, [
    initial.profile_name, initial.window_width, initial.window_height,
    initial.launch_args, initial.note, initial.group_id,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(initial.launch_config),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(initial.tags),
  ]);

  const set = <K extends keyof ProfileFormValues>(k: K, val: ProfileFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: val }));

  const setLC = <K extends keyof LaunchConfig>(k: K, val: LaunchConfig[K]) =>
    setV((prev) => ({ ...prev, launch_config: { ...prev.launch_config, [k]: val } }));

  const dirtyFields: (keyof ProfileFormValues)[] = (Object.keys(initial) as (keyof ProfileFormValues)[])
    .filter((k) => {
      if (k === 'launch_config') {
        return JSON.stringify(v.launch_config) !== JSON.stringify(initial.launch_config);
      }
      if (k === 'tags') {
        return JSON.stringify(v.tags) !== JSON.stringify(initial.tags);
      }
      return v[k] !== initial[k];
    });

  const nameValid = isValidName(v.profile_name);
  const dimsValid =
    Number.isInteger(v.window_width)  && v.window_width  >= 320 && v.window_width  <= 7680 &&
    Number.isInteger(v.window_height) && v.window_height >= 320 && v.window_height <= 7680;

  const canSave = !busy && dirtyFields.length > 0 && nameValid && dimsValid;

  const submit = () => {
    if (!canSave) return;
    const changed: ProfileConfigInput = {};
    for (const k of dirtyFields) {
      if (k === 'profile_name')    changed.profile_name  = v.profile_name;
      if (k === 'window_width')    changed.window_width  = v.window_width;
      if (k === 'window_height')   changed.window_height = v.window_height;
      if (k === 'launch_args')     changed.launch_args   = v.launch_args;
      if (k === 'note')            changed.note          = v.note;
      if (k === 'launch_config')   changed.launch_config = v.launch_config;
      if (k === 'group_id')        changed.group_id      = v.group_id;
      if (k === 'tags')            changed.tags          = v.tags;
    }
    onSubmit(v, changed);
  };

  useImperativeHandle(ref, () => ({ submit }));
  useEffect(() => { onCanSaveChange?.(canSave); }, [canSave, onCanSaveChange]);

  return (
    <div>
      <div className={twoCol ? 'pf-grid' : undefined}>
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
        <label>Group</label>
        <select
          value={v.group_id ?? ''}
          disabled={busy}
          onChange={(e) => set('group_id', e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">Ungrouped</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <label>Tags</label>
        <TagInput
          value={v.tags}
          disabled={busy}
          suggestions={tagSuggestions}
          onChange={(tags) => set('tags', tags)}
        />
        <div className="field-hint">Press Enter or comma to add. Letters/numbers/._- only, ≤32 chars, max 20 tags.</div>
      </div>

      <div className="form-row">
        <label>Window size</label>
        <select
          value={customSize ? 'Custom' : detectPreset(v.window_width, v.window_height)}
          disabled={busy}
          onChange={(e) => {
            const label = e.target.value;
            if (label === 'Custom') {
              setCustomSize(true);
              return;
            }
            const p = WINDOW_PRESETS.find((x) => x.label === label);
            if (p) {
              setCustomSize(false);
              set('window_width', p.w);
              set('window_height', p.h);
            }
          }}
        >
          {WINDOW_PRESETS.map((p) => (
            <option key={p.label} value={p.label}>{p.label}</option>
          ))}
        </select>
        {customSize && (
          <div className="dim-pair" style={{ marginTop: 8 }}>
            <input
              type="number" min={320} max={7680}
              value={v.window_width} disabled={busy}
              onChange={(e) => set('window_width', Number(e.target.value))}
            />
            <span>×</span>
            <input
              type="number" min={320} max={7680}
              value={v.window_height} disabled={busy}
              onChange={(e) => set('window_height', Number(e.target.value))}
            />
          </div>
        )}
        {!dimsValid && <div className="field-hint error">Both dimensions must be 320–7680.</div>}
        <div className="field-hint">Applies on next allocate.</div>
      </div>

      <div className="form-row">
        <label>Language</label>
        <select
          value={v.launch_config.lang ?? ''}
          disabled={busy}
          onChange={(e) => {
            const val = e.target.value;
            setLC('lang', val === '' ? undefined : val);
          }}
        >
          {LANG_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="field-hint">Sets --lang. Takes effect on next allocate.</div>
      </div>

      <div className="form-row">
        <label>Proxy</label>
        <input
          type="text"
          value={v.launch_config.proxy ?? ''}
          disabled={busy}
          placeholder="e.g. socks5://1.2.3.4:1080  or  1.2.3.4:8080"
          onChange={(e) => {
            const val = e.target.value.trim();
            setLC('proxy', val === '' ? undefined : val);
          }}
        />
        <div className="field-hint">Sets --proxy-server. Leave empty for no proxy.</div>
      </div>

      <div className="form-row pf-full">
        <label>Browser flags</label>
        <div className="flag-list">
          {BOOL_TOGGLES.map(({ key, label }) => (
            <label key={key} className="flag-item">
              <input
                type="checkbox"
                checked={!!(v.launch_config[key])}
                disabled={busy}
                onChange={(e) => setLC(key, e.target.checked ? true : undefined)}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="field-hint">Takes effect on next allocate.</div>
      </div>

      <div className="form-row pf-full">
        <label>Additional arguments</label>
        <textarea
          value={v.launch_args}
          disabled={busy}
          rows={3}
          maxLength={4000}
          placeholder="e.g. --user-agent=my-ua --flag=value"
          onChange={(e) => set('launch_args', e.target.value)}
        />
        <div className="field-hint">
          Whitespace-separated; appended after all structured flags above. Quoted args not supported. Takes effect on next allocate.
        </div>
      </div>

      <div className="form-row pf-full">
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

      </div>

      {!hideActions && (
        <div className="form-actions">
          {onCancel && (
            <button className="ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          )}
          <button className="primary" onClick={submit} disabled={!canSave}>
            {busy ? '…' : saveLabel}
          </button>
        </div>
      )}
    </div>
  );
});
