import { useEffect } from 'react';
import { ProfileForm, DEFAULT_VALUES, ProfileFormValues } from './ProfileForm';

interface Props {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (values: ProfileFormValues) => void;
}

export function CreateProfileModal({ busy, onCancel, onSubmit }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="modal modal-wide" role="dialog" aria-modal="true">
        <h2>Create profile</h2>
        <ProfileForm
          initial={DEFAULT_VALUES}
          busy={busy}
          saveLabel="Create"
          onCancel={onCancel}
          onSubmit={(values) => onSubmit(values)}
        />
      </div>
    </div>
  );
}
