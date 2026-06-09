import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listProfiles } from '../api/profiles';
import { listGroups } from '../api/groups';
import { allocateBrowser, releaseBrowser } from '../api/browser';
import { ApiError } from '../api/client';
import type { Profile } from '../api/types';
import { Icon, type IconName, IconButton, StatusDot, Button, Input, TagChip, Modal } from '../ui';
import { LiveStream, type LiveStreamHandle } from './LiveStream';
import { useToast } from './Toast';

type GroupFilter = 'all' | 'ungrouped' | number;
type GroupNameFn = (id: number | null) => string;

interface Props {
  capacity: { used: number; total: number } | null;
  onOpen: (profileId: number) => void;
}

export function LiveWall({ capacity, onOpen }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [cols, setCols] = useState(3);
  const [filterGroup, setFilterGroup] = useState<GroupFilter>('all');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [showAllocate, setShowAllocate] = useState(false);
  const [releaseTargets, setReleaseTargets] = useState<Profile[] | null>(null);
  const [busy, setBusy] = useState(false);

  const profilesQ = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, refetchInterval: 3000 });
  const groupsQ = useQuery({ queryKey: ['groups'], queryFn: listGroups, refetchInterval: 5000 });
  const profiles = profilesQ.data ?? [];
  const groups = groupsQ.data ?? [];
  const groupName: GroupNameFn = (id) => (id === null ? 'Ungrouped' : groups.find((g) => g.id === id)?.name ?? 'Ungrouped');

  const live = useMemo(() => profiles.filter((p) => p.status === 'IN_USE' && p.ws_port), [profiles]);
  const idle = useMemo(() => profiles.filter((p) => p.status === 'IDLE'), [profiles]);

  const tagCounts = useMemo(() => {
    const m: Record<string, number> = {};
    live.forEach((p) => p.tags.forEach((t) => { m[t] = (m[t] ?? 0) + 1; }));
    return m;
  }, [live]);
  const liveTags = useMemo(() => Object.keys(tagCounts).sort(), [tagCounts]);

  const groupOptions = useMemo(() => {
    const counts = new Map<number | null, number>();
    live.forEach((p) => counts.set(p.group_id, (counts.get(p.group_id) ?? 0) + 1));
    const opts: { value: GroupFilter; label: string; count: number }[] = [];
    groups.forEach((g) => { const c = counts.get(g.id); if (c) opts.push({ value: g.id, label: g.name, count: c }); });
    const ung = counts.get(null);
    if (ung) opts.push({ value: 'ungrouped', label: 'Ungrouped', count: ung });
    return opts;
  }, [live, groups]);

  // Drop filters whose targets are no longer live (e.g. after releasing them).
  useEffect(() => {
    if (filterGroup === 'all') return;
    const exists = filterGroup === 'ungrouped'
      ? groupOptions.some((o) => o.value === 'ungrouped')
      : groupOptions.some((o) => o.value === filterGroup);
    if (!exists) setFilterGroup('all');
  }, [groupOptions, filterGroup]);
  useEffect(() => {
    setFilterTags((f) => { const next = f.filter((t) => liveTags.includes(t)); return next.length === f.length ? f : next; });
  }, [liveTags]);

  const filtered = useMemo(() => live.filter((p) => {
    if (filterGroup === 'ungrouped' && p.group_id !== null) return false;
    if (filterGroup !== 'all' && filterGroup !== 'ungrouped' && p.group_id !== filterGroup) return false;
    if (filterTags.length && !filterTags.every((t) => p.tags.includes(t))) return false;
    return true;
  }), [live, filterGroup, filterTags]);

  const filterActive = filterGroup !== 'all' || filterTags.length > 0;
  const resetFilters = () => { setFilterGroup('all'); setFilterTags([]); };
  const free = capacity ? Math.max(0, capacity.total - capacity.used) : 0;

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['profiles'] }); qc.invalidateQueries({ queryKey: ['capacity'] }); };
  const handleErr = (e: unknown) => toast.error(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));

  const doAllocate = async (ids: number[]) => {
    setShowAllocate(false);
    if (ids.length === 0) return;
    setBusy(true);
    toast.info(`Allocating ${ids.length} profile${ids.length !== 1 ? 's' : ''}…`);
    const results = await Promise.allSettled(ids.map((id) => allocateBrowser(id)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    invalidate();
    if (fail === 0) toast.success(`Allocated ${ok} profile${ok !== 1 ? 's' : ''}`);
    else toast.error(`Allocated ${ok}, ${fail} failed (no free slot or launch error)`);
    setBusy(false);
  };

  const doRelease = async (targets: Profile[]) => {
    setReleaseTargets(null);
    if (targets.length === 0) return;
    setBusy(true);
    const results = await Promise.allSettled(targets.map((p) => releaseBrowser(p.id)));
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    invalidate();
    toast.success(`Released ${ok} profile${ok !== 1 ? 's' : ''}`);
    setBusy(false);
  };

  const releaseOne = async (p: Profile) => {
    setBusy(true);
    try { await releaseBrowser(p.id); invalidate(); toast.success(`Released ${p.profile_name}`); }
    catch (e) { handleErr(e); }
    finally { setBusy(false); }
  };

  const groupValue = filterGroup === 'all' || filterGroup === 'ungrouped' ? filterGroup : String(filterGroup);
  const tileHeight = cols === 4 ? 200 : cols === 3 ? 250 : 320;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Icon name="grid" size={13} style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-3)', pointerEvents: 'none' }} />
          <select
            value={groupValue}
            onChange={(e) => { const v = e.target.value; setFilterGroup(v === 'all' || v === 'ungrouped' ? v : Number(v)); }}
            style={{ appearance: 'none', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', borderRadius: 'var(--r-sm)', padding: '8px 26px 8px 28px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', width: 'auto' }}
          >
            <option value="all">All groups</option>
            {groupOptions.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label} ({o.count})</option>)}
          </select>
          <Icon name="chevDown" size={13} style={{ position: 'absolute', right: 8, top: 9, color: 'var(--text-3)', pointerEvents: 'none' }} />
        </div>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setTagsOpen((o) => !o)}
            title="Filter by tags"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer', background: (tagsOpen || filterTags.length) ? 'var(--accent-tint)' : 'var(--surface-2)', border: `1px solid ${(tagsOpen || filterTags.length) ? 'var(--accent-line)' : 'var(--border-2)'}`, color: filterTags.length ? 'var(--text)' : 'var(--text-2)', fontSize: 12.5, fontWeight: 500 }}
          >
            <Icon name="filter" size={13} />Tags
            {filterTags.length > 0 && <span className="mono" style={{ fontSize: 10.5, color: 'var(--accent)', background: 'var(--surface)', borderRadius: 99, padding: '0 5px' }}>{filterTags.length}</span>}
            <Icon name="chevDown" size={12} style={{ color: 'var(--text-3)' }} />
          </button>
          {tagsOpen && (
            <>
              <div onClick={() => setTagsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 20 }} />
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 21, width: 300, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', padding: 12 }}>
                {liveTags.length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No tags on active streams</span>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {liveTags.map((t) => (
                      <TagChip key={t} active={filterTags.includes(t)} onClick={() => setFilterTags((f) => f.includes(t) ? f.filter((x) => x !== t) : [...f, t])}>
                        {t}<span style={{ color: 'var(--text-faint)', marginLeft: 2 }}>{tagCounts[t]}</span>
                      </TagChip>
                    ))}
                    {filterTags.length > 0 && <button type="button" onClick={() => setFilterTags([])} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11.5, fontWeight: 500, cursor: 'pointer', padding: '1px 4px' }}>Clear</button>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {filterActive && <Button variant="ghost" size="sm" icon="x" onClick={resetFilters}>Reset</Button>}
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }} />

        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
          {[2, 3, 4].map((n) => <IconButton key={n} name="grid" size={n === 2 ? 13 : n === 3 ? 15 : 17} active={cols === n} onClick={() => setCols(n)} style={{ width: 28, height: 26 }} title={`${n} columns`} />)}
        </div>

        <div style={{ flex: 1 }} />

        <Button variant="outline" size="sm" icon="bolt" disabled={busy} onClick={() => setShowAllocate(true)}>Allocate</Button>
        <Button variant="outline" size="sm" danger icon="stop" disabled={filtered.length === 0 || busy} onClick={() => setReleaseTargets(filtered)}>
          {filterActive ? 'Release all shown' : 'Release all'} <span className="mono" style={{ marginLeft: 2 }}>{filtered.length}</span>
        </Button>

      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {filtered.length === 0 ? (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
            {live.length === 0 ? 'No active streams. Allocate a profile to watch it here.' : 'No active streams match the filter.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
            {filtered.map((p) => (
              <LiveWallTile key={p.id} profile={p} height={tileHeight} groupName={groupName} onOpen={onOpen} onRelease={releaseOne} />
            ))}
          </div>
        )}
      </div>

      {showAllocate && <AllocateModal idle={idle} groupName={groupName} free={free} onCancel={() => setShowAllocate(false)} onAllocate={doAllocate} />}
      {releaseTargets && <ReleaseConfirmModal targets={releaseTargets} onCancel={() => setReleaseTargets(null)} onConfirm={(selected) => doRelease(selected)} />}
    </div>
  );
}

function LiveWallTile({ profile: p, height, groupName, onOpen, onRelease }: {
  profile: Profile; height: number; groupName: GroupNameFn; onOpen: (id: number) => void; onRelease: (p: Profile) => void;
}) {
  const [menu, setMenu] = useState(false);
  const streamRef = useRef<LiveStreamHandle>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height }}>
        <div onClick={() => onOpen(p.id)} style={{ cursor: 'pointer', height: '100%' }}>
          <LiveStream ref={streamRef} profileId={p.id} wsPort={p.ws_port!} windowWidth={p.window_width} windowHeight={p.window_height} compact />
        </div>
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 8 }}>
          <button
            type="button"
            title="More"
            onClick={(e) => { e.stopPropagation(); setMenu((o) => !o); }}
            style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, padding: 0, borderRadius: 'var(--r-sm)', background: 'rgba(8,11,18,.7)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer' }}
          >
            <Icon name="dots" size={16} />
          </button>
          {menu && (
            <>
              <div onClick={(e) => { e.stopPropagation(); setMenu(false); }} style={{ position: 'fixed', inset: 0, zIndex: 7 }} />
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 9, width: 208, background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', padding: 6 }}>
                <TileMenuItem icon="maximize" label="View fullscreen" onClick={() => { setMenu(false); streamRef.current?.requestFullscreen(); }} />
                <TileMenuItem icon="stop" danger label="Release this profile" onClick={() => { setMenu(false); onRelease(p); }} />
              </div>
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 4px 2px' }}>
        <StatusDot status="IN_USE" size={8} />
        <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.profile_name}</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{groupName(p.group_id)}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>:{p.cdp_port}</span>
      </div>
    </div>
  );
}

function TileMenuItem({ icon, label, danger, onClick }: { icon: IconName; label: string; danger?: boolean; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 9px', borderRadius: 'var(--r-sm)', border: 'none', background: h ? 'var(--surface-2)' : 'transparent', color: danger ? 'var(--corrupt-text)' : 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
    >
      <Icon name={icon} size={15} style={{ color: danger ? 'var(--corrupt-text)' : 'var(--text-3)' }} />{label}
    </button>
  );
}

function AllocateModal({ idle, groupName, free, onCancel, onAllocate }: {
  idle: Profile[]; groupName: GroupNameFn; free: number; onCancel: () => void; onAllocate: (ids: number[]) => void;
}) {
  const [sel, setSel] = useState<Set<number>>(() => new Set());
  const [q, setQ] = useState('');
  const filtered = idle.filter((p) => !q || p.profile_name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const over = sel.size > free;
  return (
    <Modal
      title="Allocate profiles"
      subtitle={`Launch idle profiles onto the wall · ${free} slot${free !== 1 ? 's' : ''} free`}
      icon="bolt"
      width={560}
      onClose={onCancel}
      footer={(
        <>
          <span style={{ flex: 1, fontSize: 12.5, color: over ? 'var(--alloc-text)' : 'var(--text-3)', textAlign: 'left' }}>
            {sel.size} selected{over ? ` · only ${free} slot${free !== 1 ? 's' : ''} free` : ''}
          </span>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" icon="bolt" disabled={sel.size === 0} onClick={() => onAllocate([...sel])}>Allocate {sel.size || ''}</Button>
        </>
      )}
    >
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-3)' }} />
        <Input placeholder="Filter idle profiles…" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 30 }} />
      </div>
      <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>No idle profiles</div>
        ) : filtered.map((p, i) => {
          const checked = sel.has(p.id);
          return (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 13px', cursor: 'pointer', borderBottom: i === filtered.length - 1 ? 'none' : '1px solid var(--border)', background: checked ? 'var(--accent-tint)' : 'transparent' }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`, background: checked ? 'var(--accent)' : 'transparent', flex: 'none' }}>
                {checked && <Icon name="check" size={12} style={{ color: '#fff' }} />}
              </span>
              <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} style={{ display: 'none' }} />
              <StatusDot status="IDLE" size={8} />
              <span className="mono" style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.profile_name}</span>
              <span style={{ fontSize: 11.5, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{groupName(p.group_id)}</span>
            </label>
          );
        })}
      </div>
      {over && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--alloc-text)', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="alert" size={14} />You selected more than the {free} free slot{free !== 1 ? 's' : ''} — the extra profiles will fail to allocate.
        </div>
      )}
    </Modal>
  );
}

function ReleaseConfirmModal({ targets, onCancel, onConfirm }: { targets: Profile[]; onCancel: () => void; onConfirm: (selected: Profile[]) => void }) {
  const [sel, setSel] = useState<Set<number>>(() => new Set(targets.map((p) => p.id)));
  const toggle = (id: number) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSel = targets.length > 0 && targets.every((p) => sel.has(p.id));
  const toggleAll = () => setSel(allSel ? new Set() : new Set(targets.map((p) => p.id)));
  const selected = targets.filter((p) => sel.has(p.id));

  return (
    <Modal
      title="Release profiles?"
      subtitle="Pick which streams to release — their slots will be freed."
      icon="alert"
      width={520}
      onClose={onCancel}
      footer={(
        <>
          <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-3)', textAlign: 'left' }}>{sel.size} of {targets.length} selected</span>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" danger icon="stop" disabled={sel.size === 0} onClick={() => onConfirm(selected)}>Release {sel.size}</Button>
        </>
      )}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{targets.length} active stream{targets.length !== 1 ? 's' : ''}</span>
        <button type="button" onClick={toggleAll} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '2px 4px' }}>
          {allSel ? 'Clear all' : 'Select all'}
        </button>
      </div>
      <div style={{ maxHeight: 320, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {targets.map((p) => {
          const checked = sel.has(p.id);
          return (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', cursor: 'pointer', borderRadius: 'var(--r-sm)', background: checked ? 'var(--accent-tint)' : 'var(--surface-2)', border: `1px solid ${checked ? 'var(--accent-line)' : 'var(--border)'}` }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`, background: checked ? 'var(--accent)' : 'transparent', flex: 'none' }}>
                {checked && <Icon name="check" size={12} style={{ color: '#fff' }} />}
              </span>
              <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} style={{ display: 'none' }} />
              <StatusDot status="IN_USE" size={8} />
              <span className="mono" style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.profile_name}</span>
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>#{p.slot_id ?? '—'}</span>
            </label>
          );
        })}
      </div>
    </Modal>
  );
}
