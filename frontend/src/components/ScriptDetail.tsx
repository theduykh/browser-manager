import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Profile, Script, ScriptStep } from '../api/types';
import { getReport } from '../api/scripts';
import { StepEditor } from './StepEditor';
import { RunReportView } from './RunReportView';
import { RunModal } from './RunModal';
import { RecordPanel } from './RecordPanel';

interface Props {
  script: Script;
  profiles: Profile[];
  busy: boolean;
  onSave: (patch: { name?: string; description?: string; steps?: ScriptStep[] }) => void;
  onDelete: () => void;
}

export function ScriptDetail({ script, profiles, busy, onSave, onDelete }: Props) {
  const [name, setName] = useState(script.name);
  const [description, setDescription] = useState(script.description);
  const [steps, setSteps] = useState<ScriptStep[]>(script.steps);
  const [showRun, setShowRun] = useState(false);
  const [showRecord, setShowRecord] = useState(false);

  const reportQ = useQuery({
    queryKey: ['script-report', script.id],
    queryFn: () => getReport(script.id),
  });
  const report = reportQ.data ?? null;

  const dirty =
    name !== script.name ||
    description !== script.description ||
    JSON.stringify(steps) !== JSON.stringify(script.steps);

  const nameValid = name.trim().length > 0;

  return (
    <div>
      <div className="detail-header">
        <div>
          <h1>{script.name}</h1>
          <div className="subtitle">
            <span>id #{script.id}</span>
            <span style={{ marginLeft: 12 }}>{script.steps.length} step(s)</span>
            {script.last_run && (
              <span className={`run-pill run-${script.last_run.status}`} style={{ marginLeft: 12 }}>
                last run: {script.last_run.status}
              </span>
            )}
          </div>
        </div>

        <div className="actions actions-top">
          <button
            className="primary"
            disabled={busy || dirty || script.steps.length === 0}
            title={dirty ? 'Save changes before running' : script.steps.length === 0 ? 'Add steps first' : ''}
            onClick={() => setShowRun(true)}
          >
            Run
          </button>
          <button
            className="danger"
            disabled={busy}
            onClick={() => confirm(`Delete script '${script.name}'?`) && onDelete()}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="detail-section">
        <h3>Details</h3>
        <div className="form-row">
          <label>Name</label>
          <input type="text" value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-row">
          <label>Description</label>
          <textarea rows={2} value={description} disabled={busy} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div className="detail-section">
        <div className="section-head">
          <h3>Steps</h3>
          <button onClick={() => setShowRecord(true)}>● Record</button>
        </div>
        <StepEditor steps={steps} disabled={busy} onChange={setSteps} />
      </div>

      <div className="detail-section">
        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="primary" disabled={busy || !dirty || !nameValid} onClick={() => onSave({ name: name.trim(), description, steps })}>
            Save changes
          </button>
          {dirty && <span className="field-hint" style={{ alignSelf: 'center' }}>Unsaved changes</span>}
        </div>
      </div>

      <div className="detail-section">
        <h3>Last report</h3>
        {report
          ? <RunReportView report={report} steps={script.steps} />
          : <div className="field-hint">No runs yet. Use “Run” to execute this script on one or more profiles.</div>}
      </div>

      {showRun && (
        <RunModal script={script} profiles={profiles} onClose={() => setShowRun(false)} />
      )}
      {showRecord && (
        <RecordPanel
          profiles={profiles}
          onClose={() => setShowRecord(false)}
          onComplete={(recorded) => setSteps((prev) => [...prev, ...recorded])}
        />
      )}
    </div>
  );
}
