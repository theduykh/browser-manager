import type { RunReport, ScriptStep, StepStatus } from '../api/types';
import { stepSummary } from '../lib/steps';

const STEP_ICON: Record<StepStatus, string> = {
  pending: '○', running: '◐', passed: '✓', failed: '✕', skipped: '–',
};

interface Props {
  report: RunReport;
  steps?: ScriptStep[];
}

export function RunReportView({ report, steps }: Props) {
  const byId = new Map((steps ?? []).map((s) => [s.id, s]));

  return (
    <div className="run-report">
      <div className="run-overall">
        <span className={`run-pill run-${report.status}`}>{report.status}</span>
        <span className="run-meta">{report.targets.length} profile(s)</span>
      </div>

      {report.targets.map((t) => (
        <div className="run-target" key={t.profileId}>
          <div className="run-target-head">
            <span className="run-target-name">{t.profileName}</span>
            <span className={`run-pill run-${t.status}`}>{t.status}</span>
            {t.allocated && <span className="run-tag">auto-allocated</span>}
          </div>

          {t.error && <div className="run-target-error">{t.error}</div>}

          <ol className="run-steps">
            {t.steps.map((s) => {
              const detail = byId.get(s.stepId);
              return (
                <li key={s.stepId} className={`run-step run-step-${s.status}`}>
                  <span className="run-step-icon">{STEP_ICON[s.status]}</span>
                  <span className="run-step-type">{s.type}</span>
                  <span className="run-step-detail">{detail ? stepSummary(detail) : ''}</span>
                  {s.durationMs != null && <span className="run-step-dur">{s.durationMs}ms</span>}
                  {s.error && <span className="run-step-err">{s.error}</span>}
                </li>
              );
            })}
          </ol>

          {t.screenshot && (
            <img className="run-screenshot" src={t.screenshot} alt="Failure screenshot" />
          )}
        </div>
      ))}
    </div>
  );
}
