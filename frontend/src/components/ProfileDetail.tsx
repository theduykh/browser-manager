import { useMemo } from 'react';
import type { Group, Profile, ProfileConfigInput } from '../api/types';
import { ProfileForm, ProfileFormValues } from './ProfileForm';
import { LiveView } from '../pages/LiveView';

interface Props {
  profile: Profile;
  busy: boolean;
  groups: Group[];
  tagSuggestions?: string[];
  onSave: (patch: ProfileConfigInput) => void;
  onAllocate: () => void;
  onRelease: () => void;
  onReset: () => void;
  onDelete: () => void;
}

export function ProfileDetail({
  profile, busy, groups, tagSuggestions, onSave, onAllocate, onRelease, onReset, onDelete,
}: Props) {
  const initial: ProfileFormValues = useMemo(() => ({
    profile_name:  profile.profile_name,
    window_width:  profile.window_width,
    window_height: profile.window_height,
    launch_args:   profile.launch_args,
    note:          profile.note,
    group_id:      profile.group_id,
    tags:          profile.tags,
    launch_config: (() => {
      try {
        const p = JSON.parse(profile.launch_config);
        return (p !== null && typeof p === 'object' && !Array.isArray(p)) ? p : {};
      } catch { return {}; }
    })(),
  }), [profile.id, profile.profile_name, profile.window_width,
       profile.window_height, profile.launch_args, profile.note, profile.launch_config,
       // eslint-disable-next-line react-hooks/exhaustive-deps
       profile.group_id, JSON.stringify(profile.tags)]);

  const isInUse = profile.status === 'IN_USE';
  const isCorrupt = profile.status === 'CORRUPT';

  return (
    <div>
      <div className="detail-header">
        <div>
          <h1>{profile.profile_name}</h1>
          <div className="subtitle">
            <span className={`status-pill status-${profile.status}`}>{profile.status}</span>
            <span style={{ marginLeft: 12 }}>id #{profile.id}</span>
          </div>
        </div>

        <div className="actions actions-top">
          {profile.status === 'IDLE' && (
            <button className="primary" disabled={busy} onClick={onAllocate}>Allocate</button>
          )}
          {isInUse && (
            <button disabled={busy} onClick={onRelease}>Release</button>
          )}
          {(isCorrupt || isInUse) && (
            <button disabled={busy} onClick={onReset}>Reset</button>
          )}
          {!isInUse && (
            <button
              className="danger"
              disabled={busy}
              onClick={() => confirm(`Delete '${profile.profile_name}'?`) && onDelete()}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {isInUse && profile.ws_port && (
        <div className="detail-section">
          <h3>Live View</h3>
          <LiveView
            key={`${profile.id}-${profile.ws_port}`}
            profileId={profile.id}
            wsPort={profile.ws_port}
            windowWidth={profile.window_width}
            windowHeight={profile.window_height}
          />
        </div>
      )}

      <div className="detail-section">
        <h3>Configuration</h3>
        <ProfileForm
          key={profile.id}
          initial={initial}
          busy={busy}
          groups={groups}
          tagSuggestions={tagSuggestions}
          lockName={isInUse}
          saveLabel="Save changes"
          onSubmit={(_v, changed) => onSave(changed)}
        />
      </div>

      <div className="detail-section">
        <h3>Runtime info</h3>
        <div className="field-row">
          <span className="label">Folder path</span>
          <span className="value">{profile.folder_path}</span>
        </div>
        <div className="field-row">
          <span className="label">Slot</span>
          <span className="value">{profile.slot_id ?? '—'}</span>
        </div>
        <div className="field-row">
          <span className="label">WS port (Live View)</span>
          <span className="value">{profile.ws_port ?? '—'}</span>
        </div>
        <div className="field-row">
          <span className="label">CDP port</span>
          <span className="value">
            {profile.cdp_port
              ? `${profile.cdp_port} (http://${window.location.hostname}:${profile.cdp_port})`
              : '—'}
          </span>
        </div>
        <div className="field-row">
          <span className="label">PIDs</span>
          <span className="value">{profile.pids?.join(', ') ?? '—'}</span>
        </div>
        <div className="field-row">
          <span className="label">Allocated at</span>
          <span className="value">{profile.allocated_at ?? '—'}</span>
        </div>
        <div className="field-row">
          <span className="label">Last active</span>
          <span className="value">{profile.last_active}</span>
        </div>
      </div>
    </div>
  );
}
