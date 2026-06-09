import { useEffect, useState } from 'react';
import type { Group } from '../api/types';
import { Modal, Button } from '../ui';

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
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<Group | null>(null);

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
    <div className="modal-backdrop">
      <div className="modal modal-wide" role="dialog" aria-modal="true">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>Manage groups</h2>
          <button className="ghost" onClick={onClose} disabled={busy} style={{ margin: 0 }}>Close</button>
        </div>

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
                    onClick={() => setDeleteConfirmGroup(g)}
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
      </div>

      {deleteConfirmGroup && (
        <Modal
          title="Delete group?"
          subtitle="This action cannot be undone."
          icon="alert"
          width={440}
          onClose={() => setDeleteConfirmGroup(null)}
          footer={
            <>
              <Button variant="ghost" disabled={busy} onClick={() => setDeleteConfirmGroup(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                danger
                icon="trash"
                disabled={busy}
                onClick={() => {
                  onDelete(deleteConfirmGroup.id);
                  setDeleteConfirmGroup(null);
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Are you sure you want to permanently delete the group <strong style={{ color: 'var(--text)', fontWeight: 600 }}>{deleteConfirmGroup.name}</strong>? Its profiles will become Ungrouped.
          </div>
        </Modal>
      )}
    </div>
  );
}
