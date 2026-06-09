import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listProfiles, createProfile, deleteProfile, resetProfile, updateProfile,
} from '../api/profiles';
import { listGroups, createGroup, renameGroup, deleteGroup } from '../api/groups';
import { allocateBrowser, releaseBrowser } from '../api/browser';
import { getCapacity } from '../api/capacity';
import { ApiError } from '../api/client';
import type { Profile, ProfileConfigInput } from '../api/types';
import { CreateProfileModal } from '../components/CreateProfileModal';
import { ManageGroupsModal } from '../components/ManageGroupsModal';
import { ProfileRail, type Filters } from '../components/ProfileRail';
import { ProfilesToolbar } from '../components/ProfilesToolbar';
import { ProfileCard } from '../components/ProfileCard';
import { ProfileTable } from '../components/ProfileTable';
import { ProfileDetailView } from '../components/ProfileDetailView';
import type { ProfileFormValues } from '../components/ProfileForm';
import type { Density, ProfileAction, Sort, StatusFilter, ViewMode } from '../components/profiles.types';
import { Icon } from '../ui';
import { useToast } from '../components/Toast';

interface Props {
  focusProfileId: number | null;
  onFocusConsumed: () => void;
}

const STATUS_ORDER: Record<Profile['status'], number> = { IN_USE: 0, CORRUPT: 1, IDLE: 2 };

export function Dashboard({ focusProfileId, onFocusConsumed }: Props) {
  const qc = useQueryClient();
  const toast = useToast();

  const [openId, setOpenId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [filters, setFilters] = useState<Filters>({ group: 'all', tags: [], q: '' });
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<Sort>({ key: 'status', dir: 'asc' });
  const [view, setView] = useState<ViewMode>('grid');
  const [density, setDensity] = useState<Density>('comfortable');

  const profilesQ = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, refetchInterval: 3000 });
  const groupsQ = useQuery({ queryKey: ['groups'], queryFn: listGroups, refetchInterval: 5000 });
  const capacityQ = useQuery({ queryKey: ['capacity'], queryFn: getCapacity, refetchInterval: 3000 });

  const profiles = profilesQ.data ?? [];
  const groups = groupsQ.data ?? [];
  const capacity = capacityQ.data ?? null;

  const allTags = useMemo(() => Array.from(new Set(profiles.flatMap((p) => p.tags))).sort(), [profiles]);
  const groupName = (id: number | null) => (id === null ? 'Ungrouped' : groups.find((g) => g.id === id)?.name ?? 'Ungrouped');

  // Focus a specific profile when requested from the Live Wall.
  useEffect(() => {
    if (focusProfileId !== null) { setOpenId(focusProfileId); onFocusConsumed(); }
  }, [focusProfileId, onFocusConsumed]);

  // Drop the open profile if it disappears (deleted).
  useEffect(() => {
    if (openId !== null && !profiles.some((p) => p.id === openId)) setOpenId(null);
  }, [profiles, openId]);

  const filtered = useMemo(() => {
    const arr = profiles.filter((p) => {
      if (filters.group === 'ungrouped' && p.group_id !== null) return false;
      if (filters.group !== 'all' && filters.group !== 'ungrouped' && p.group_id !== filters.group) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (filters.tags.length && !filters.tags.every((t) => p.tags.includes(t))) return false;
      if (filters.q && !p.profile_name.toLowerCase().includes(filters.q.toLowerCase())) return false;
      return true;
    });
    arr.sort((a, b) => {
      let r = 0;
      if (sort.key === 'status') r = (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || a.profile_name.localeCompare(b.profile_name);
      else if (sort.key === 'name') r = a.profile_name.localeCompare(b.profile_name);
      else if (sort.key === 'group') r = groupName(a.group_id).localeCompare(groupName(b.group_id));
      else if (sort.key === 'lastUsed') r = Date.parse(b.last_active) - Date.parse(a.last_active);
      else if (sort.key === 'slot') r = (a.slot_id ?? 99) - (b.slot_id ?? 99);
      return sort.dir === 'desc' ? -r : r;
    });
    return arr;
  }, [profiles, filters, statusFilter, sort, groups]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['profiles'] });
    qc.invalidateQueries({ queryKey: ['capacity'] });
  };
  const invalidateGroups = () => {
    qc.invalidateQueries({ queryKey: ['groups'] });
    qc.invalidateQueries({ queryKey: ['profiles'] });
  };
  const handleErr = (e: unknown) => toast.error(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));

  const createM = useMutation({
    mutationFn: createProfile,
    onSuccess: (p) => { invalidate(); setOpenId(p.id); setShowCreate(false); toast.success(`Profile "${p.profile_name}" created`); },
    onError: handleErr,
  });
  const deleteM = useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => { invalidate(); setOpenId(null); toast.success('Profile deleted'); },
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
  const busy = createM.isPending || deleteM.isPending || resetM.isPending || updateM.isPending || allocateM.isPending || releaseM.isPending;
  const allocatingId = allocateM.isPending ? (allocateM.variables ?? null) : null;


  const doAction = (action: ProfileAction, p: Profile) => {
    if (action === 'allocate') allocateM.mutate(p.id);
    else if (action === 'release') releaseM.mutate(p.id);
    else if (action === 'reset') resetM.mutate(p.id);
    else if (action === 'delete') deleteM.mutate(p.id);
  };

  const selected = openId !== null ? profiles.find((p) => p.id === openId) : undefined;

  return (
    <>
      <ProfileRail
        profiles={profiles}
        list={filtered}
        groups={groups}
        filters={filters}
        setFilters={setFilters}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        selectedId={openId}
        allocatingId={allocatingId}
        capacity={capacity}
        onOpen={setOpenId}
        onNew={() => setShowCreate(true)}
        onManageGroups={() => setShowGroups(true)}
      />

      {selected ? (
        <ProfileDetailView
          profile={selected}
          groups={groups}
          tagSuggestions={allTags}
          busy={busy}
          allocating={allocatingId === selected.id}
          onBack={() => setOpenId(null)}
          onAction={(action) => doAction(action, selected)}
          onSave={(patch: Partial<ProfileFormValues>) => updateM.mutate({ id: selected.id, patch })}
        />
      ) : (
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
          <ProfilesToolbar
            count={filtered.length}
            total={profiles.length}
            view={view}
            setView={setView}
            density={density}
            setDensity={setDensity}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            sort={sort}
            setSort={setSort}
          />
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            {filtered.length === 0 ? (
              <div style={{ height: '60%', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
                <div style={{ textAlign: 'center' }}>
                  <Icon name="search" size={26} style={{ color: 'var(--text-faint)' }} />
                  <div style={{ marginTop: 10 }}>
                    {profilesQ.isLoading ? 'Loading…' : profiles.length === 0 ? 'No profiles yet — create one to get started.' : 'No profiles match your filters'}
                  </div>
                </div>
              </div>
            ) : view === 'grid' ? (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${density === 'compact' ? 230 : 270}px, 1fr))`, gap: density === 'compact' ? 10 : 14 }}>
                {filtered.map((p) => (
                  <ProfileCard key={p.id} p={p} density={density} allocatingId={allocatingId} groupName={groupName} onOpen={setOpenId} onAction={doAction} />
                ))}
              </div>
            ) : (
              <ProfileTable profiles={filtered} allocatingId={allocatingId} groupName={groupName} onOpen={setOpenId} onAction={doAction} sort={sort} setSort={setSort} />
            )}
          </div>
        </main>
      )}

      {showCreate && (
        <CreateProfileModal
          busy={createM.isPending}
          groups={groups}
          tagSuggestions={allTags}
          onCancel={() => setShowCreate(false)}
          onSubmit={(values: ProfileFormValues) => createM.mutate({ ...values, profile_name: values.profile_name.trim() })}
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
    </>
  );
}
