import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group, LaunchConfig, Profile } from '../api/types';
import {
  Icon, StatusDot, StatusPill, Button, IconButton, TagChip, KV, SectionCard,
  timeAgo, STATUS, type UiStatus, Modal,
} from '../ui';
import { LiveStream } from './LiveStream';
import { ProfileForm, type ProfileFormValues, type ProfileFormHandle } from './ProfileForm';
import { QuickRunScript } from './QuickRunScript';
import type { ProfileAction } from './profiles.types';

interface Props {
  profile: Profile;
  groups: Group[];
  tagSuggestions: string[];
  busy: boolean;
  allocating: boolean;
  onBack: () => void;
  onAction: (action: ProfileAction) => void;
  onSave: (patch: Partial<ProfileFormValues>) => void;
}

function parseLC(raw: string): LaunchConfig {
  try {
    const p = JSON.parse(raw);
    return p && typeof p === 'object' && !Array.isArray(p) ? (p as LaunchConfig) : {};
  } catch { return {}; }
}

// Live hero fills most of the viewport (minus top bar + detail header) so the open
// profile is operable without fullscreen; clamped so it stays sane on tiny/huge screens.
const HERO_H = 'clamp(440px, calc(100vh - 165px), 1180px)';

export function ProfileDetailView({ profile: p, groups, tagSuggestions, busy, allocating, onBack, onAction, onSave }: Props) {
  const status: UiStatus = allocating ? 'ALLOCATING' : p.status;
  const groupName = (id: number | null) => (id === null ? 'Ungrouped' : groups.find((g) => g.id === id)?.name ?? 'Ungrouped');

  const initial: ProfileFormValues = useMemo(() => ({
    profile_name: p.profile_name,
    window_width: p.window_width,
    window_height: p.window_height,
    launch_args: p.launch_args,
    note: p.note,
    launch_config: parseLC(p.launch_config),
    group_id: p.group_id,
    tags: p.tags,
  }), [p.id, p.profile_name, p.window_width, p.window_height, p.launch_args, p.note, p.launch_config, p.group_id, JSON.stringify(p.tags)]);

  const isInUse = status === 'IN_USE';

  const formRef = useRef<ProfileFormHandle>(null);
  const [canSaveConfig, setCanSaveConfig] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px' }}>
          <IconButton name="arrowLeft" size={18} onClick={onBack} title="Back to profiles" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-3)' }}>
            <span>Profiles</span><Icon name="chevRight" size={13} /><span>{groupName(p.group_id)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginLeft: 4, minWidth: 0 }}>
            <StatusDot status={status} size={10} />
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '-.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.profile_name}</h1>
            <StatusPill status={status} />
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 9 }}>
            {status === 'IDLE' && <Button variant="primary" icon="bolt" disabled={busy} onClick={() => onAction('allocate')}>Allocate</Button>}
            {status === 'ALLOCATING' && <Button variant="default" disabled style={{ cursor: 'wait' }}><StatusDot status="ALLOCATING" />Allocating…</Button>}
            {status === 'IN_USE' && <Button variant="default" danger icon="stop" disabled={busy} onClick={() => onAction('release')}>Release</Button>}
            {status === 'CORRUPT' && <Button variant="primary" danger icon="refresh" disabled={busy} onClick={() => onAction('reset')}>Reset profile</Button>}
            <IconButton name="trash" size={16} title={isInUse ? 'Release before deleting' : 'Delete profile'} danger disabled={busy || isInUse} onClick={() => setShowDeleteConfirm(true)} />
          </div>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24, maxWidth: 1840, margin: '0 auto', width: '100%' }}>
        {/* HERO — live view as large as possible (full width, ~viewport tall) so the
            user can operate the open profile without entering fullscreen. */}
        {isInUse && p.ws_port ? (
          <div style={{ height: HERO_H }}>
            <LiveStream profileId={p.id} wsPort={p.ws_port} windowWidth={p.window_width} windowHeight={p.window_height} />
          </div>
        ) : status === 'ALLOCATING' ? (
          <div style={{ height: HERO_H }}><AllocatingHero /></div>
        ) : (
          <EmptyHero corrupt={status === 'CORRUPT'} busy={busy} onAction={onAction} />
        )}

        <SectionCard title="Run a script" icon="play" action={!isInUse ? <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Profile must be allocated</span> : null}>
          {isInUse
            ? <QuickRunScript profile={p} />
            : <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>Allocate this profile to run or record a script against it.</div>}
        </SectionCard>

        {/* Runtime + Profile — moved below Run a script, side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: isInUse ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
          {isInUse && (
            <SectionCard title="Runtime" icon="server" action={<span style={{ fontSize: 11, color: 'var(--inuse-text)', display: 'inline-flex', alignItems: 'center', gap: 5 }}><StatusDot status="IN_USE" size={6} />active</span>}>
              <KV k="Slot" v={p.slot_id != null ? `#${p.slot_id}` : '—'} />
              <KV k="Live-view port" v={p.ws_port ?? '—'} copyable />
              <KV k="Debug port" v={p.cdp_port ?? '—'} copyable />
              <KV k="CDP endpoint" v={p.cdp_port ? `${window.location.hostname}:${p.cdp_port}` : '—'} copyable />
              <KV k="PIDs" v={p.pids?.join(', ') ?? '—'} />
              <KV k="Uptime" v={p.allocated_at ? timeAgo(p.allocated_at).replace(' ago', '') : '—'} />
            </SectionCard>
          )}

          <SectionCard title="Profile" icon="layers">
            <KV k="ID" v={p.id} copyable />
            <KV k="Group" v={groupName(p.group_id)} mono={false} />
            <KV k="Folder" v={p.folder_path} />
            <KV k="Created" v={timeAgo(p.created_at)} mono={false} />
            <KV k="Last used" v={timeAgo(p.last_active)} mono={false} />
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 8 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {p.tags.length === 0 && <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>No tags — add them in Configuration.</span>}
                {p.tags.map((t) => <TagChip key={t} small>{t}</TagChip>)}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Configuration — full width, short fields in 2 columns */}
        <SectionCard
          title="Configuration"
          icon="settings"
          action={(
            <Button size="sm" variant="primary" icon="check" disabled={!canSaveConfig} onClick={() => formRef.current?.submit()}>
              Save changes
            </Button>
          )}
        >
          <ProfileForm
            ref={formRef}
            key={p.id}
            initial={initial}
            busy={busy}
            groups={groups}
            tagSuggestions={tagSuggestions}
            lockName={isInUse}
            saveLabel="Save changes"
            twoCol
            hideActions
            onCanSaveChange={setCanSaveConfig}
            onSubmit={(_v, changed) => onSave(changed)}
          />
        </SectionCard>
      </div>
      {showDeleteConfirm && (
        <Modal
          title="Delete profile?"
          subtitle="This action cannot be undone."
          icon="alert"
          width={440}
          onClose={() => setShowDeleteConfirm(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                danger
                icon="trash"
                disabled={busy}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onAction('delete');
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Are you sure you want to permanently delete the profile <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{p.profile_name}</strong>? This will remove all configuration, cookies, and local browser data.
          </div>
        </Modal>
      )}
    </div>
  );
}

function AllocatingHero() {
  const steps = ['Reserving slot', 'Starting virtual display', 'Launching Chromium', 'Attaching debug port', 'Opening noVNC stream'];
  const [pct, setPct] = useState(8);
  const stepIx = Math.min(steps.length - 1, Math.floor((pct / 100) * steps.length));
  useEffect(() => {
    const id = setInterval(() => setPct((x) => Math.min(96, x + Math.random() * 14)), 600);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ height: '100%', borderRadius: 'var(--r-lg)', border: '1px solid var(--alloc-line)', background: 'var(--surface)', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 40%, var(--alloc-tint), transparent 60%)' }} />
      <div style={{ textAlign: 'center', zIndex: 2, width: 320 }}>
        <Icon name="refresh" size={30} style={{ color: 'var(--alloc-text)', animation: 'spin 1s linear infinite' }} />
        <div style={{ marginTop: 16, fontSize: 14.5, fontWeight: 600 }}>Allocating profile…</div>
        <div className="mono" style={{ marginTop: 5, fontSize: 12, color: 'var(--text-3)' }}>{steps[stepIx]}</div>
        <div style={{ marginTop: 18, height: 6, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--c-alloc)', transition: 'width .6s var(--ease)' }} />
        </div>
        <div className="mono" style={{ marginTop: 8, fontSize: 11, color: 'var(--text-faint)' }}>headful Chromium on virtual display</div>
      </div>
    </div>
  );
}

function EmptyHero({ corrupt, busy, onAction }: { corrupt: boolean; busy: boolean; onAction: (a: ProfileAction) => void }) {
  return (
    <div style={{ height: 360, borderRadius: 'var(--r-lg)', border: '1px dashed var(--border-2)', background: 'var(--surface)', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)', backgroundSize: '22px 22px', opacity: 0.5 }} />
      <div style={{ textAlign: 'center', zIndex: 2 }}>
        <div style={{ display: 'grid', placeItems: 'center', width: 56, height: 56, borderRadius: '50%', margin: '0 auto', background: corrupt ? 'var(--corrupt-tint)' : 'var(--surface-2)', border: `1px solid ${corrupt ? 'var(--corrupt-line)' : 'var(--border-2)'}` }}>
          <Icon name={corrupt ? 'alert' : 'monitor'} size={26} style={{ color: corrupt ? 'var(--corrupt-text)' : 'var(--text-3)' }} />
        </div>
        <div style={{ marginTop: 16, fontSize: 15, fontWeight: 600 }}>{corrupt ? 'Profile is corrupt' : 'No live session'}</div>
        <div style={{ marginTop: 5, fontSize: 13, color: 'var(--text-2)', maxWidth: 340 }}>
          {corrupt ? 'Reset the profile to clean its lock files, then allocate.' : 'Allocate this profile to launch a headful Chromium and stream it live here.'}
        </div>
        <div style={{ marginTop: 18 }}>
          {corrupt
            ? <Button variant="primary" danger icon="refresh" disabled={busy} onClick={() => onAction('reset')}>Reset profile</Button>
            : <Button variant="primary" icon="bolt" disabled={busy} onClick={() => onAction('allocate')}>Allocate &amp; launch</Button>}
        </div>
      </div>
    </div>
  );
}
