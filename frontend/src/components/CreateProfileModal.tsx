import { useEffect, useRef, useState } from 'react';
import type { Group } from '../api/types';
import { ProfileForm, DEFAULT_VALUES, type ProfileFormValues, type ProfileFormHandle } from './ProfileForm';

interface Props {
  busy: boolean;
  groups: Group[];
  tagSuggestions?: string[];
  onCancel: () => void;
  onSubmit: (values: ProfileFormValues) => void;
  onManageGroups: () => void;
}

export function CreateProfileModal({ busy, groups, tagSuggestions, onCancel, onSubmit, onManageGroups }: Props) {
  const formRef = useRef<ProfileFormHandle>(null);
  const [canSave, setCanSave] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop">
      <div className="modal modal-wide" role="dialog" aria-modal="true" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
        <h2 style={{ padding: '24px 24px 16px', margin: 0, flexShrink: 0 }}>Create profile</h2>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          <ProfileForm
            ref={formRef}
            initial={DEFAULT_VALUES}
            busy={busy}
            groups={groups}
            tagSuggestions={tagSuggestions}
            hideActions
            onCanSaveChange={setCanSave}
            onSubmit={(values) => onSubmit(values)}
            onManageGroups={onManageGroups}
          />
        </div>
        <div style={{ padding: '14px 24px', flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 8, background: 'var(--surface-2)', borderTop: '1px solid var(--border)', borderRadius: '0 0 8px 8px' }}>
          <button type="button" className="ghost" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="primary" onClick={() => formRef.current?.submit()} disabled={!canSave}>
            {busy ? '…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
