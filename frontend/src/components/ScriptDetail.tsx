import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Profile, Script, ScriptStep } from '../api/types';
import { getReport } from '../api/scripts';
import { Icon, IconButton, Button, SectionCard, KV, Modal } from '../ui';
import { timeAgo } from '../ui/format';
import { StepEditor } from './StepEditor';
import { RunReportView } from './RunReportView';
import { RunModal } from './RunModal';
import { RecordPanel } from './RecordPanel';

interface Props {
  script: Script;
  profiles: Profile[];
  busy: boolean;
  onBack: () => void;
  onSave: (patch: { name?: string; description?: string; steps?: ScriptStep[] }) => void;
  onDelete: () => void;
}

export function ScriptDetail({ script, profiles, busy, onBack, onSave, onDelete }: Props) {
  const [name, setName] = useState(script.name);
  const [description, setDescription] = useState(script.description);
  const [steps, setSteps] = useState<ScriptStep[]>(script.steps);
  const [showRun, setShowRun] = useState(false);
  const [showRecord, setShowRecord] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const lastRunColor = script.last_run?.status === 'passed' ? 'var(--idle-text)'
    : script.last_run?.status === 'failed' ? 'var(--corrupt-text)'
      : 'var(--text-3)';

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
      {/* Sticky header — matches ProfileDetailView */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px' }}>
          <IconButton name="arrowLeft" size={18} onClick={onBack} title="Back to scripts" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-3)' }}>
            <span>Scripts</span><Icon name="chevRight" size={13} /><span>#{script.id}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginLeft: 4, minWidth: 0 }}>
            <Icon name="play" size={16} style={{ color: 'var(--accent)', flex: 'none' }} />
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '-.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {script.name}
            </h1>
            {script.last_run && (
              <span style={{ fontSize: 11, fontWeight: 600, color: lastRunColor, textTransform: 'uppercase', letterSpacing: '.04em', padding: '2px 8px', borderRadius: 99, background: script.last_run.status === 'passed' ? 'var(--idle-tint)' : script.last_run.status === 'failed' ? 'var(--corrupt-tint)' : 'var(--surface-2)' }}>
                {script.last_run.status}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }} />
          {dirty && <span style={{ fontSize: 12, color: 'var(--accent)', marginRight: 2 }}>Unsaved changes</span>}
          <div style={{ display: 'flex', gap: 9 }}>
            <Button
              variant="primary"
              icon="check"
              disabled={busy || !dirty || !nameValid}
              onClick={() => onSave({ name: name.trim(), description, steps })}
            >
              Save
            </Button>
            <Button
              variant="primary"
              icon="play"
              disabled={busy || dirty || script.steps.length === 0}
              onClick={() => setShowRun(true)}
            >
              Run
            </Button>
            <IconButton
              name="trash"
              size={16}
              title="Delete script"
              danger
              disabled={busy}
              onClick={() => setShowDeleteConfirm(true)}
            />
          </div>
        </div>
      </header>

      {/* Content area — card-based sections like ProfileDetailView */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24, maxWidth: 1840, margin: '0 auto', width: '100%' }}>
        {/* Details & Info — side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 20, alignItems: 'stretch' }}>
          <SectionCard title="Details" icon="settings">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Name</label>
                <input
                  type="text"
                  value={name}
                  disabled={busy}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-mono)', background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-sm)', color: 'var(--text)', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Description</label>
                <textarea
                  value={description}
                  disabled={busy}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: '100%', flex: 1, minHeight: 90, padding: '8px 12px', fontSize: 13, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-sm)', color: 'var(--text)', outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Info" icon="layers">
            <KV k="ID" v={script.id} copyable />
            <KV k="Steps" v={`${script.steps.length} step${script.steps.length !== 1 ? 's' : ''}`} mono={false} />
            <KV k="Created" v={timeAgo(script.created_at)} mono={false} />
            <KV k="Updated" v={timeAgo(script.updated_at)} mono={false} />
            {script.last_run && (
              <>
                <KV k="Last run" v={script.last_run.status} mono={false} />
                <KV k="Run finished" v={timeAgo(script.last_run.finished_at)} mono={false} />
              </>
            )}
          </SectionCard>
        </div>

        {/* Steps editor — full width content inside card */}
        <SectionCard
          title="Steps"
          icon="play"
          pad={0}
          action={
            <Button size="sm" variant="outline" icon="monitor" onClick={() => setShowRecord(true)}>
              Record
            </Button>
          }
        >
          <StepEditor steps={steps} disabled={busy} onChange={setSteps} />
        </SectionCard>

        {/* Last report — full width content inside card */}
        <SectionCard title="Last report" icon="table" pad={0}>
          {report
            ? <RunReportView report={report} steps={script.steps} />
            : <div style={{ padding: 18, fontSize: 12.5, color: 'var(--text-3)' }}>No runs yet. Use "Run" to execute this script on one or more profiles.</div>}
        </SectionCard>
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
      {showDeleteConfirm && (
        <Modal
          title="Delete script?"
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
                  onDelete();
                }}
              >
                Delete
              </Button>
            </>
          }
        >
          <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Are you sure you want to permanently delete the script <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{script.name}</strong>? This will remove all of its steps and run history.
          </div>
        </Modal>
      )}
    </div>
  );
}
