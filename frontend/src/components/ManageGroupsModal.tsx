import { useEffect, useState } from 'react';
import type { Group } from '../api/types';

interface Props {
  groups: Group[];
  busy: boolean;
  onCreate: (name: string) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

export function ManageGroupsModal({ groups, busy, onCreate, onRename, onDelete, onClose }: Props) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const startEdit = (g: Group) => { setEditingId(g.id); setEditName(g.name); };
  const cancelEdit = () => { setEditingId(null); setEditName(''); };

  const commitRename = (id: number) => {
    const name = editName.trim();
    if (name === '') return;
    onRename(id, name);
    cancelEdit();
  };

  const commitCreate = () => {
    const name = newName.trim();
    if (name === '') return;
    onCreate(name);
    setNewName('');
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal modal-wide" role="dialog" aria-modal="true">
        <h2>Manage groups</h2>

        <div className="group-list">
          {groups.length === 0 && (
            <div className="group-list-empty">No groups yet.</div>
          )}
          {groups.map((g) => (
            <div key={g.id} className="group-row">
              {editingId === g.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    disabled={busy}
                    autoFocus
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(g.id);
                      if (e.key === 'Escape') cancelEdit();
                    }}
                  />
                  <button className="primary" disabled={busy} onClick={() => commitRename(g.id)}>Save</button>
                  <button className="ghost" disabled={busy} onClick={cancelEdit}>Cancel</button>
                </>
              ) : (
                <>
                  <span className="group-name" title={g.name}>{g.name}</span>
                  <span className="group-count">{g.profile_count}</span>
                  <button disabled={busy} onClick={() => startEdit(g)}>Rename</button>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`Delete group "${g.name}"? Its profiles become Ungrouped.`)) onDelete(g.id);
                    }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="group-create">
          <input
            type="text"
            value={newName}
            disabled={busy}
            placeholder="New group name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitCreate(); }}
          />
          <button className="primary" disabled={busy || newName.trim() === ''} onClick={commitCreate}>
            Add
          </button>
        </div>

        <div className="modal-actions">
          <button className="ghost" onClick={onClose} disabled={busy}>Close</button>
        </div>
      </div>
    </div>
  );
}
