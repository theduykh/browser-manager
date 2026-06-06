import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listProfiles, createProfile, deleteProfile, resetProfile, updateProfile,
} from '../api/profiles';
import { listGroups, createGroup, renameGroup, deleteGroup } from '../api/groups';
import { allocateBrowser, releaseBrowser } from '../api/browser';
import { ApiError } from '../api/client';
import type { Profile, ProfileConfigInput } from '../api/types';
import { CreateProfileModal } from '../components/CreateProfileModal';
import { ManageGroupsModal } from '../components/ManageGroupsModal';
import { ProfileDetail } from '../components/ProfileDetail';
import { ProfileFormValues } from '../components/ProfileForm';
import { useToast } from '../components/Toast';

type GroupFilter = 'all' | 'ungrouped' | number;

export function Dashboard() {
  const qc = useQueryClient();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [filterGroup, setFilterGroup] = useState<GroupFilter>('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const profilesQ = useQuery({
    queryKey: ['profiles'],
    queryFn: listProfiles,
    refetchInterval: 3000,
  });

  const groupsQ = useQuery({
    queryKey: ['groups'],
    queryFn: listGroups,
    refetchInterval: 5000,
  });

  const profiles = profilesQ.data ?? [];
  const groups = groupsQ.data ?? [];

  const allTags = useMemo(
    () => Array.from(new Set(profiles.flatMap((p) => p.tags))).sort(),
    [profiles],
  );

  const visibleProfiles = useMemo(() => profiles.filter((p) => {
    const groupOk =
      filterGroup === 'all' ? true :
      filterGroup === 'ungrouped' ? p.group_id === null :
      p.group_id === filterGroup;
    const tagsOk = filterTags.every((t) => p.tags.includes(t));
    return groupOk && tagsOk;
  }), [profiles, filterGroup, filterTags]);

  // Auto-select first visible profile when the filtered list changes or the selection
  // falls outside it (e.g. the selected profile was filtered out or deleted).
  useEffect(() => {
    if (visibleProfiles.length === 0) { setSelectedId(null); return; }
    if (selectedId === null || !visibleProfiles.some((p) => p.id === selectedId)) {
      setSelectedId(visibleProfiles[0].id);
    }
  }, [visibleProfiles, selectedId]);

  const selected: Profile | undefined = useMemo(
    () => profiles.find((p) => p.id === selectedId),
    [profiles, selectedId],
  );

  const filterActive = filterGroup !== 'all' || filterTags.length > 0;
  const clearFilters = () => { setFilterGroup('all'); setFilterTags([]); };
  const toggleTagFilter = (tag: string) =>
    setFilterTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const groupName = (id: number | null) =>
    id === null ? 'Ungrouped' : (groups.find((g) => g.id === id)?.name ?? 'Ungrouped');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['profiles'] });
  // Deleting/renaming a group changes profiles' group_id, so refresh both caches.
  const invalidateGroups = () => {
    qc.invalidateQueries({ queryKey: ['groups'] });
    qc.invalidateQueries({ queryKey: ['profiles'] });
  };
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

  const createGroupM = useMutation({
    mutationFn: (name: string) => createGroup(name),
    onSuccess: (g) => { invalidateGroups(); toast.success(`Group "${g.name}" created`); },
    onError: handleErr,
  });
  const renameGroupM = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameGroup(id, name),
    onSuccess: () => { invalidateGroups(); toast.success('Group renamed'); },
    onError: handleErr,
  });
  const deleteGroupM = useMutation({
    mutationFn: (id: number) => deleteGroup(id),
    onSuccess: () => { invalidateGroups(); toast.success('Group deleted'); },
    onError: handleErr,
  });

  const groupsBusy = createGroupM.isPending || renameGroupM.isPending || deleteGroupM.isPending;

  const busy =
    createM.isPending || deleteM.isPending || resetM.isPending ||
    updateM.isPending || allocateM.isPending || releaseM.isPending;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Profiles</h2>
          <div className="sidebar-header-actions">
            <button className="primary" onClick={() => setShowCreate(true)}>
              + Create profile
            </button>
            <button onClick={() => setShowGroups(true)}>
              Manage groups
            </button>
          </div>
        </div>

        <div className="filter-bar">
          <select
            value={String(filterGroup)}
            onChange={(e) => {
              const val = e.target.value;
              setFilterGroup(val === 'all' || val === 'ungrouped' ? val : Number(val));
            }}
          >
            <option value="all">All groups</option>
            <option value="ungrouped">Ungrouped</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>

          {allTags.length > 0 && (
            <div className="tag-filter">
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`tag-filter-chip ${filterTags.includes(t) ? 'is-active' : ''}`}
                  onClick={() => toggleTagFilter(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {filterActive && (
            <div className="filter-bar-actions">
              <button className="ghost" onClick={clearFilters}>Clear filters</button>
            </div>
          )}
        </div>

        <div className="sidebar-list">
          {visibleProfiles.length === 0 && (
            <div className="sidebar-empty">
              {profilesQ.isLoading
                ? 'Loading…'
                : profiles.length === 0
                  ? 'No profiles yet.'
                  : 'No profiles match the filters.'}
            </div>
          )}
          {visibleProfiles.map((p) => (
            <div
              key={p.id}
              className={`sidebar-item ${p.id === selectedId ? 'active' : ''}`}
              onClick={() => setSelectedId(p.id)}
            >
              <div className="sidebar-item-main">
                <span className="name">{p.profile_name}</span>
                <span className={`status-pill status-${p.status}`}>{p.status}</span>
              </div>
              <div className="sidebar-item-meta">
                <span className="group-label">{groupName(p.group_id)}</span>
                {p.tags.length > 0 && (
                  <span className="meta-tags">
                    {p.tags.map((t) => (
                      <span key={t} className="tag-chip">{t}</span>
                    ))}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          {filterActive
            ? `${visibleProfiles.length} of ${profiles.length} profile(s)`
            : `${profiles.length} profile(s)`}
        </div>
      </aside>

      <main className="detail">
        {selected ? (
          <ProfileDetail
            profile={selected}
            busy={busy}
            groups={groups}
            tagSuggestions={allTags}
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
          groups={groups}
          tagSuggestions={allTags}
          onCancel={() => setShowCreate(false)}
          onSubmit={(values: ProfileFormValues) =>
            // Spread all form values so new fields are never silently dropped on create.
            createM.mutate({ ...values, profile_name: values.profile_name.trim() })
          }
        />
      )}

      {showGroups && (
        <ManageGroupsModal
          groups={groups}
          busy={groupsBusy}
          onCreate={(name) => createGroupM.mutate(name)}
          onRename={(id, name) => renameGroupM.mutate({ id, name })}
          onDelete={(id) => deleteGroupM.mutate(id)}
          onClose={() => setShowGroups(false)}
        />
      )}
    </div>
  );
}
