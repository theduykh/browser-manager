import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listProfiles, createProfile, deleteProfile, resetProfile, updateProfile,
} from '../api/profiles';
import { allocateBrowser, releaseBrowser } from '../api/browser';
import { ApiError } from '../api/client';
import type { Profile, ProfileConfigInput } from '../api/types';
import { CreateProfileModal } from '../components/CreateProfileModal';
import { ProfileDetail } from '../components/ProfileDetail';
import { ProfileFormValues } from '../components/ProfileForm';
import { useToast } from '../components/Toast';

export function Dashboard() {
  const qc = useQueryClient();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const profilesQ = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    refetchInterval: 3000,
  });

  const profiles = profilesQ.data ?? [];

  // Auto-select first profile when list first loads or selected is deleted
  useEffect(() => {
    if (profiles.length === 0) { setSelectedId(null); return; }
    if (selectedId === null || !profiles.some((p) => p.id === selectedId)) {
      setSelectedId(profiles[0].id);
    }
  }, [profiles, selectedId]);

  const selected: Profile | undefined = useMemo(
    () => profiles.find((p) => p.id === selectedId),
    [profiles, selectedId],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ['profiles'] });
  const handleErr = (e: unknown) => {
    toast.error(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
  };

  const createM = useMutation({
    mutationFn: createProfile,
    onSuccess: (p) => {
      invalidate();
      setSelectedId(p.id);
      setShowCreate(false);
      toast.success(`Profile "${p.profile_name}" created`);
    },
    onError: handleErr,
  });
  const deleteM = useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => { invalidate(); toast.success('Profile deleted'); },
    onError: handleErr,
  });
  const resetM = useMutation({
    mutationFn: resetProfile,
    onSuccess: () => { invalidate(); toast.success('Profile reset to IDLE'); },
    onError: handleErr,
  });
  const updateM = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: ProfileConfigInput }) => updateProfile(id, patch),
    onSuccess: () => { invalidate(); toast.success('Changes saved'); },
    onError: handleErr,
  });
  const allocateM = useMutation({
    mutationFn: (profileId: number) => allocateBrowser(profileId),
    // Profile becomes IN_USE → ProfileDetail will render the embedded LiveView automatically on next poll.
    onSuccess: () => { invalidate(); toast.success('Browser allocated'); },
    onError: handleErr,
  });
  const releaseM = useMutation({
    mutationFn: releaseBrowser,
    onSuccess: () => { invalidate(); toast.success('Browser released'); },
    onError: handleErr,
  });

  const busy =
    createM.isPending || deleteM.isPending || resetM.isPending ||
    updateM.isPending || allocateM.isPending || releaseM.isPending;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Profiles</h2>
          <button
            className="primary"
            style={{ width: '100%' }}
            onClick={() => setShowCreate(true)}
          >
            + Create profile
          </button>
        </div>

        <div className="sidebar-list">
          {profiles.length === 0 && (
            <div className="sidebar-empty">
              {profilesQ.isLoading ? 'Loading…' : 'No profiles yet.'}
            </div>
          )}
          {profiles.map((p) => (
            <div
              key={p.id}
              className={`sidebar-item ${p.id === selectedId ? 'active' : ''}`}
              onClick={() => setSelectedId(p.id)}
            >
              <span className="name">{p.profile_name}</span>
              <span className={`status-pill status-${p.status}`}>{p.status}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">{profiles.length} profile(s)</div>
      </aside>

      <main className="detail">
        {selected ? (
          <ProfileDetail
            profile={selected}
            busy={busy}
            onSave={(patch) => updateM.mutate({ id: selected.id, patch })}
            onAllocate={() => allocateM.mutate(selected.id)}
            onRelease={() => releaseM.mutate(selected.id)}
            onReset={() => resetM.mutate(selected.id)}
            onDelete={() => deleteM.mutate(selected.id)}
          />
        ) : (
          <div className="detail-empty">
            {profiles.length === 0
              ? 'Click "Create profile" to get started.'
              : 'Select a profile from the left.'}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateProfileModal
          busy={createM.isPending}
          onCancel={() => setShowCreate(false)}
          onSubmit={(values: ProfileFormValues) =>
            createM.mutate({
              profile_name:  values.profile_name.trim(),
              window_width:  values.window_width,
              window_height: values.window_height,
              launch_args:   values.launch_args,
              note:          values.note,
            })
          }
        />
      )}
    </div>
  );
}
