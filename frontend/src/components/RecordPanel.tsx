import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Profile, ScriptStep } from '../api/types';
import { ApiError } from '../api/client';
import { startRecording, getRecording, stopRecording } from '../api/scripts';
import { stepSummary } from '../lib/steps';
import { useToast } from './Toast';
import { LiveView } from '../pages/LiveView';

interface Props {
  profiles: Profile[];
  onClose: () => void;
  onComplete: (steps: ScriptStep[]) => void;
}

export function RecordPanel({ profiles, onClose, onComplete }: Props) {
  const toast = useToast();
  const openProfiles = profiles.filter((p) => p.status === 'IN_USE' && p.ws_port);
  const [profileId, setProfileId] = useState<number | null>(openProfiles.length === 1 ? openProfiles[0].id : null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const profile = profiles.find((p) => p.id === profileId);

  const recQ = useQuery({
    queryKey: ['recording', recordingId],
    queryFn: () => getRecording(recordingId!),
    enabled: !!recordingId,
    refetchInterval: 800,
  });
  const steps = recQ.data?.steps ?? [];

  const handleErr = (e: unknown) =>
    toast.error(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));

  const start = async () => {
    if (profileId == null) return;
    setWorking(true);
    try {
      const res = await startRecording(profileId);
      setRecordingId(res.recording_id);
      toast.info('Recording — interact with the browser below');
    } catch (e) { handleErr(e); }
    finally { setWorking(false); }
  };

  const stopAndSave = async () => {
    if (!recordingId) return;
    setWorking(true);
    try {
      const res = await stopRecording(recordingId);
      onComplete(res.steps);
      toast.success(`Captured ${res.steps.length} step(s)`);
      onClose();
    } catch (e) { handleErr(e); setWorking(false); }
  };

  // Cancel: stop the recording (discard captured steps) so the backend session and
  // CDP connection are released.
  const cancel = async () => {
    if (recordingId) { try { await stopRecording(recordingId); } catch { /* ignore */ } }
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void cancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId]);

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) void cancel(); }}>
      <div className="modal modal-xl" role="dialog" aria-modal="true">
        <h2>Record script</h2>

        {openProfiles.length === 0 && (
          <div className="field-hint">No open browsers. Allocate a profile first, then record.</div>
        )}

        {openProfiles.length > 0 && (
          <div className="record-body">
            <div className="record-stage">
              {!recordingId && (
                <div className="form-row" style={{ marginBottom: 12 }}>
                  <label>Profile to record</label>
                  <select
                    value={profileId ?? ''}
                    onChange={(e) => setProfileId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select an open profile…</option>
                    {openProfiles.map((p) => (
                      <option key={p.id} value={p.id}>{p.profile_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {profile && profile.ws_port && (
                <LiveView
                  key={`${profile.id}-${profile.ws_port}`}
                  profileId={profile.id}
                  wsPort={profile.ws_port}
                  windowWidth={profile.window_width}
                  windowHeight={profile.window_height}
                />
              )}
            </div>

            <div className="record-steps">
              <div className="record-steps-head">
                <span className={`conn-dot ${recordingId ? 'conn-connected' : 'conn-disconnected'}`} />
                <span>{recordingId ? 'Recording' : 'Idle'}</span>
                <span className="record-count">{steps.length} step(s)</span>
              </div>
              <ol className="record-step-list">
                {steps.map((s) => (
                  <li key={s.id}>
                    <span className="record-step-type">{s.type}</span>
                    <span className="record-step-detail">{stepSummary(s)}</span>
                  </li>
                ))}
                {recordingId && steps.length === 0 && (
                  <li className="record-step-hint">Interact with the page to capture steps…</li>
                )}
              </ol>
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button className="ghost" onClick={() => void cancel()}>Cancel</button>
          {!recordingId ? (
            <button className="primary" disabled={working || profileId == null} onClick={() => void start()}>
              Start recording
            </button>
          ) : (
            <button className="primary" disabled={working} onClick={() => void stopAndSave()}>
              Stop &amp; save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
