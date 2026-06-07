import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Profile, Script, RunReport } from '../api/types';
import { ApiError } from '../api/client';
import { runScript, getRun } from '../api/scripts';
import { useToast } from './Toast';
import { RunReportView } from './RunReportView';

interface Props {
  script: Script;
  profiles: Profile[];
  onClose: () => void;
}

export function RunModal({ script, profiles, onClose }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [autoAllocate, setAutoAllocate] = useState(true);
  const [stopOnError, setStopOnError] = useState(true);
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const runQ = useQuery({
    queryKey: ['run', runId],
    queryFn: () => getRun(runId!),
    enabled: !!runId,
    refetchInterval: (q) => {
      const d = q.state.data as RunReport | undefined;
      return d && d.status !== 'running' ? false : 1000;
    },
  });
  const report = runQ.data;

  useEffect(() => {
    if (report && report.status !== 'running') {
      qc.invalidateQueries({ queryKey: ['scripts'] });
      qc.invalidateQueries({ queryKey: ['script-report', script.id] });
    }
  }, [report?.status, qc, script.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (id: number) => setSelected((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const start = async () => {
    if (selected.size === 0) { toast.error('Select at least one profile'); return; }
    setStarting(true);
    try {
      const res = await runScript(script.id, { targets: [...selected], autoAllocate, stopOnError });
      setRunId(res.run_id);
    } catch (e) {
      toast.error(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-wide" role="dialog" aria-modal="true">
        <h2>Run “{script.name}”</h2>

        {!runId ? (
          <>
            <div className="form-row" style={{ maxWidth: 'none' }}>
              <label>Target profiles</label>
              <div className="run-target-picker">
                {profiles.length === 0 && <div className="field-hint">No profiles yet.</div>}
                {profiles.map((p) => (
                  <label key={p.id} className="run-target-option">
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                    <span className="run-target-option-name">{p.profile_name}</span>
                    <span className={`status-pill status-${p.status}`}>{p.status}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flag-list" style={{ marginBottom: 16 }}>
              <label className="flag-item">
                <input type="checkbox" checked={autoAllocate} onChange={(e) => setAutoAllocate(e.target.checked)} />
                Auto-allocate idle profiles (open, run, then release)
              </label>
              <label className="flag-item">
                <input type="checkbox" checked={stopOnError} onChange={(e) => setStopOnError(e.target.checked)} />
                Stop a profile on first failed step
              </label>
            </div>

            <div className="modal-actions">
              <button className="ghost" onClick={onClose}>Cancel</button>
              <button className="primary" disabled={starting || selected.size === 0} onClick={() => void start()}>
                Run on {selected.size} profile(s)
              </button>
            </div>
          </>
        ) : (
          <>
            {report
              ? <RunReportView report={report} steps={script.steps} />
              : <div className="field-hint">Starting run…</div>}
            <div className="modal-actions">
              <button className="ghost" onClick={() => { setRunId(null); }}>Back</button>
              <button className="primary" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
