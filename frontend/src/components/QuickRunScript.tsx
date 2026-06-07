import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RunReport } from '../api/types';
import { ApiError } from '../api/client';
import { listScripts, runScript, getRun } from '../api/scripts';
import { useToast } from './Toast';
import { RunReportView } from './RunReportView';

// Quick-run a saved script directly on an already-open (IN_USE) profile.
export function QuickRunScript({ profileId }: { profileId: number }) {
  const toast = useToast();
  const scriptsQ = useQuery({ queryKey: ['scripts'], queryFn: listScripts });
  const scripts = scriptsQ.data ?? [];
  const [scriptId, setScriptId] = useState<number | ''>('');
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
  const selectedScript = scripts.find((s) => s.id === scriptId);

  const run = async () => {
    if (scriptId === '') return;
    setStarting(true);
    try {
      const res = await runScript(Number(scriptId), { targets: [profileId], autoAllocate: false, stopOnError: true });
      setRunId(res.run_id);
    } catch (e) {
      toast.error(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div>
      <div className="quick-run-bar">
        <select value={scriptId} onChange={(e) => setScriptId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">Select a script…</option>
          {scripts.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button
          className="primary"
          disabled={starting || scriptId === '' || (selectedScript?.steps.length ?? 0) === 0}
          onClick={() => void run()}
        >
          Run on this profile
        </button>
      </div>
      {scripts.length === 0 && <div className="field-hint">No scripts yet. Create one in the Scripts tab.</div>}
      {report && (
        <div style={{ marginTop: 12 }}>
          <RunReportView report={report} steps={selectedScript?.steps} />
        </div>
      )}
    </div>
  );
}
