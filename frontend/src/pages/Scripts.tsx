import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listScripts, createScript, updateScript, deleteScript } from '../api/scripts';
import { listProfiles } from '../api/profiles';
import { ApiError } from '../api/client';
import type { ScriptStep } from '../api/types';
import { ScriptDetail } from '../components/ScriptDetail';
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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Scripts</h2>
          <div className="sidebar-header-actions">
            <button className="primary" onClick={() => setShowCreate(true)}>+ New script</button>
          </div>
        </div>

        <div className="sidebar-list">
          {scripts.length === 0 && (
            <div className="sidebar-empty">{scriptsQ.isLoading ? 'Loading…' : 'No scripts yet.'}</div>
          )}
          {scripts.map((s) => (
            <div
              key={s.id}
              className={`sidebar-item ${s.id === selectedId ? 'active' : ''}`}
              onClick={() => setSelectedId(s.id)}
            >
              <div className="sidebar-item-main">
                <span className="name">{s.name}</span>
                {s.last_run && <span className={`run-pill run-${s.last_run.status}`}>{s.last_run.status}</span>}
              </div>
              <div className="sidebar-item-meta">
                <span>{s.steps.length} step(s)</span>
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">{scripts.length} script(s)</div>
      </aside>

      <main className="detail">
        {selected ? (
          <ScriptDetail
            key={selected.id}
            script={selected}
            profiles={profiles}
            busy={busy}
            onSave={(patch) => updateM.mutate({ id: selected.id, patch })}
            onDelete={() => deleteM.mutate(selected.id)}
          />
        ) : (
          <div className="detail-empty">
            {scripts.length === 0 ? 'Click "New script" to get started.' : 'Select a script from the left.'}
          </div>
        )}
      </main>

      {showCreate && (
        <NewScriptModal
          busy={createM.isPending}
          name={newName}
          onName={setNewName}
          onCancel={() => { setShowCreate(false); setNewName(''); }}
          onSubmit={() => { if (newName.trim()) createM.mutate(newName.trim()); }}
        />
      )}
    </div>
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        <h2>New script</h2>
        <div className="form-row">
          <label>Name</label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => onName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSubmit(); }}
            placeholder="e.g. Login flow"
          />
        </div>
        <div className="modal-actions">
          <button className="ghost" onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={busy || !name.trim()} onClick={onSubmit}>Create</button>
        </div>
      </div>
    </div>
  );
}
