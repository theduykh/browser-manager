import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listScripts, createScript, updateScript, deleteScript } from '../api/scripts';
import { listProfiles } from '../api/profiles';
import { ApiError } from '../api/client';
import type { ScriptStep } from '../api/types';
import { ScriptRail } from '../components/ScriptRail';
import { ScriptDetail } from '../components/ScriptDetail';
import { Icon, Modal, Input, Button } from '../ui';
import { useToast } from '../components/Toast';

type Patch = { name?: string; description?: string; steps?: ScriptStep[] };

export function Scripts() {
  const qc = useQueryClient();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const scriptsQ = useQuery({ queryKey: ['scripts'], queryFn: listScripts, refetchInterval: 3000 });
  const profilesQ = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, refetchInterval: 3000 });
  const scripts = scriptsQ.data ?? [];
  const profiles = profilesQ.data ?? [];

  useEffect(() => {
    if (scripts.length === 0) { setSelectedId(null); return; }
    if (selectedId === null || !scripts.some((s) => s.id === selectedId)) setSelectedId(scripts[0].id);
  }, [scripts, selectedId]);

  const selected = useMemo(() => scripts.find((s) => s.id === selectedId), [scripts, selectedId]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['scripts'] });
  const handleErr = (e: unknown) =>
    toast.error(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));

  const createM = useMutation({
    mutationFn: (name: string) => createScript({ name, steps: [] }),
    onSuccess: (s) => {
      invalidate();
      setSelectedId(s.id);
      setShowCreate(false);
      setNewName('');
      toast.success(`Script "${s.name}" created`);
    },
    onError: handleErr,
  });
  const updateM = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Patch }) => updateScript(id, patch),
    onSuccess: () => { invalidate(); toast.success('Saved'); },
    onError: handleErr,
  });
  const deleteM = useMutation({
    mutationFn: (id: number) => deleteScript(id),
    onSuccess: () => { invalidate(); toast.success('Script deleted'); },
    onError: handleErr,
  });

  const busy = createM.isPending || updateM.isPending || deleteM.isPending;

  return (
    <>
      <ScriptRail
        scripts={scripts}
        selectedId={selectedId}
        loading={scriptsQ.isLoading}
        onSelect={setSelectedId}
        onNew={() => setShowCreate(true)}
      />

      {selected ? (
        <ScriptDetail
          key={selected.id}
          script={selected}
          profiles={profiles}
          busy={busy}
          onBack={() => setSelectedId(null)}
          onSave={(patch) => updateM.mutate({ id: selected.id, patch })}
          onDelete={() => deleteM.mutate(selected.id)}
        />
      ) : (
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
            <div style={{ textAlign: 'center' }}>
              <Icon name="play" size={26} style={{ color: 'var(--text-faint)' }} />
              <div style={{ marginTop: 10 }}>
                {scriptsQ.isLoading ? 'Loading…' : scripts.length === 0 ? 'No scripts yet — click "+" to get started.' : 'Select a script from the left.'}
              </div>
            </div>
          </div>
        </main>
      )}

      {showCreate && (
        <NewScriptModal
          busy={createM.isPending}
          name={newName}
          onName={setNewName}
          onCancel={() => { setShowCreate(false); setNewName(''); }}
          onSubmit={() => { if (newName.trim()) createM.mutate(newName.trim()); }}
        />
      )}
    </>
  );
}

function NewScriptModal({
  busy, name, onName, onCancel, onSubmit,
}: {
  busy: boolean;
  name: string;
  onName: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal
      title="New script"
      subtitle="Create a new automation script"
      icon="play"
      width={440}
      onClose={onCancel}
      footer={(
        <>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" icon="plus" disabled={busy || !name.trim()} onClick={onSubmit}>Create</Button>
        </>
      )}
    >
      <div>
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Name</label>
        <Input
          autoFocus
          placeholder="e.g. Login flow"
          value={name}
          onChange={(e) => onName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSubmit(); }}
        />
      </div>
    </Modal>
  );
}
