import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Profile, RunReport, ScriptStep } from '../api/types';
import { ApiError } from '../api/client';
import { listScripts, runScript, getRun, createScript } from '../api/scripts';
import { useToast } from './Toast';
import { RunReportView } from './RunReportView';
import { RecordPanel } from './RecordPanel';
import { Button, Modal, Field, Input } from '../ui';

// Quick-run a saved script — or record a brand-new one — directly on an
// already-open (IN_USE) profile.
export function QuickRunScript({ profile }: { profile: Profile }) {
  const toast = useToast();
  const qc = useQueryClient();
  const scriptsQ = useQuery({ queryKey: ['scripts'], queryFn: listScripts });
  const scripts = scriptsQ.data ?? [];
  const [scriptId, setScriptId] = useState<number | ''>('');
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Record-new-script flow
  const [showRecord, setShowRecord] = useState(false);
  const [pendingSteps, setPendingSteps] = useState<ScriptStep[] | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

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
  const handleErr = (e: unknown) => toast.error(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));

  const run = async () => {
    if (scriptId === '') return;
    setStarting(true);
    try {
      const res = await runScript(Number(scriptId), { targets: [profile.id], autoAllocate: false, stopOnError: true });
      setRunId(res.run_id);
    } catch (e) { handleErr(e); }
    finally { setStarting(false); }
  };

  const saveRecorded = async () => {
    if (!pendingSteps || !newName.trim()) return;
    setCreating(true);
    try {
      const s = await createScript({ name: newName.trim(), steps: pendingSteps });
      qc.invalidateQueries({ queryKey: ['scripts'] });
      toast.success(`Script "${s.name}" created · ${pendingSteps.length} step(s)`);
      setPendingSteps(null);
      setNewName('');
    } catch (e) { handleErr(e); }
    finally { setCreating(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={scriptId}
          onChange={(e) => setScriptId(e.target.value ? Number(e.target.value) : '')}
          style={{ flex: '1 1 220px', width: 'auto', minWidth: 0, padding: '8px 10px', fontSize: 13 }}
        >
          <option value="">Select a script…</option>
          {scripts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <Button
          variant="primary"
          icon="play"
          disabled={starting || scriptId === '' || (selectedScript?.steps.length ?? 0) === 0}
          onClick={() => void run()}
        >
          Run on this profile
        </Button>
        <Button variant="outline" icon="record" onClick={() => setShowRecord(true)}>
          Record new script
        </Button>
      </div>

      {scripts.length === 0 && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-3)' }}>
          No saved scripts yet — record one here, or create one in the Scripts tab.
        </div>
      )}

      {report && (
        <div style={{ marginTop: 12 }}>
          <RunReportView report={report} steps={selectedScript?.steps} />
        </div>
      )}

      {showRecord && (
        <RecordPanel
          profiles={[profile]}
          onClose={() => setShowRecord(false)}
          onComplete={(steps) => setPendingSteps(steps)}
        />
      )}

      {pendingSteps && (
        <Modal
          title="Save recorded script"
          subtitle={`${pendingSteps.length} step(s) captured on ${profile.profile_name}`}
          icon="record"
          width={460}
          onClose={() => { setPendingSteps(null); setNewName(''); }}
          footer={(
            <>
              <Button variant="ghost" onClick={() => { setPendingSteps(null); setNewName(''); }}>Discard</Button>
              <Button variant="primary" icon="check" disabled={!newName.trim() || creating} onClick={() => void saveRecorded()}>Create script</Button>
            </>
          )}
        >
          <Field label="Script name" hint="Letters, numbers and . _ - @ · saved to the Scripts tab.">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) void saveRecorded(); }}
              placeholder="e.g. checkout-happy-path"
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}
