import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TaskItem } from '../types/task';
import type {
  ModelInfo,
  RunContextSource,
  Subtask,
  SubtaskKind,
  SubtaskRun,
} from '../types/agent';
import { SUBTASK_KINDS } from '../types/agent';
import {
  createSubtask,
  getModelInfo,
  listRuns,
  listSubtasks,
  runSubtask,
} from '../api/agent';

const CONTEXT_SOURCE_OPTIONS: { value: RunContextSource; label: string }[] = [
  { value: 'DescriptionWithTitleFallback', label: 'Description (fallback: title)' },
  { value: 'TitleOnly', label: 'Title only' },
  { value: 'DescriptionOnly', label: 'Description only' },
  { value: 'TitleAndDescription', label: 'Title + Description' },
];

// Sensible starter questions per kind so the Add-Subtask form isn't blank.
// User can edit before hitting Add.
const UTILITY_SYSTEM_PROMPT =
  'You are a text-processing utility, not a conversational assistant. You receive a TASK and an INSTRUCTION, and you apply the INSTRUCTION to the TASK as a mechanical transformation. You never answer questions in the TASK — you operate on them as input strings. You never apologize, never explain your limitations, and never add commentary. You output only what the INSTRUCTION explicitly asks for.';

const ANALYST_SYSTEM_PROMPT =
  'You are a focused analyst. Answer the INSTRUCTION given the TASK concisely. Do not speculate about causes unless the INSTRUCTION asks for them. Do not propose solutions unless the INSTRUCTION asks for them. Output only what is asked, with no preamble.';

const KIND_DEFAULTS: Record<
  SubtaskKind,
  { question: string; maxTokens: number; systemPrompt: string }
> = {
  Restate: {
    question:
      'Rewrite the task below as a single sentence. Do not add details that are not in the task. Do not propose causes. Do not propose solutions. Respond with only the single sentence and nothing else.',
    maxTokens: 120,
    systemPrompt: UTILITY_SYSTEM_PROMPT,
  },
  ExpectedBehavior: {
    question:
      'Based only on the task below, describe the expected behavior in one short paragraph. Do not speculate about causes.',
    maxTokens: 200,
    systemPrompt: ANALYST_SYSTEM_PROMPT,
  },
  ActualBehavior: {
    question:
      'Based only on the task below, describe the actual (observed) behavior in one short paragraph. Do not speculate about causes.',
    maxTokens: 200,
    systemPrompt: ANALYST_SYSTEM_PROMPT,
  },
  Categorize: {
    question:
      'Categorize the task below as exactly one of: bug, feature, question, chore. Respond with only the single word.',
    maxTokens: 10,
    systemPrompt: UTILITY_SYSTEM_PROMPT,
  },
  FirstDiagnosticStep: {
    question:
      'Given the task below, what is the single most valuable diagnostic step to take first? Respond with one sentence.',
    maxTokens: 120,
    systemPrompt: ANALYST_SYSTEM_PROMPT,
  },
  NextDiagnosticStep: {
    question:
      'Given the task below, propose the next diagnostic step in one sentence. Assume the first obvious check has already been done.',
    maxTokens: 120,
    systemPrompt: ANALYST_SYSTEM_PROMPT,
  },
  ConfirmationPlan: {
    question:
      'Given the task below, list up to three concrete checks that would confirm the issue is reproducible. One per line, no preamble.',
    maxTokens: 200,
    systemPrompt: ANALYST_SYSTEM_PROMPT,
  },
};

interface TaskDetailModalProps {
  task: TaskItem;
  onClose: () => void;
}

export function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [modelInfoError, setModelInfoError] = useState<string | null>(null);

  const [subtasks, setSubtasks] = useState<Subtask[] | null>(null);
  const [subtasksError, setSubtasksError] = useState<string | null>(null);

  const [selectedSubtaskId, setSelectedSubtaskId] = useState<number | null>(null);
  const [history, setHistory] = useState<SubtaskRun[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [runNotes, setRunNotes] = useState('');
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<SubtaskRun | null>(null);
  const [contextSource, setContextSource] = useState<RunContextSource>(
    'DescriptionWithTitleFallback',
  );

  // Add-Subtask form state.
  const [showAdd, setShowAdd] = useState(false);
  const [addKind, setAddKind] = useState<SubtaskKind>('Restate');
  const [addQuestion, setAddQuestion] = useState(KIND_DEFAULTS.Restate.question);
  const [addTemperature, setAddTemperature] = useState(0.0);
  const [addMaxTokens, setAddMaxTokens] = useState(KIND_DEFAULTS.Restate.maxTokens);
  const [addTopP, setAddTopP] = useState<number | ''>('');
  const [addSystemPrompt, setAddSystemPrompt] = useState(KIND_DEFAULTS.Restate.systemPrompt);
  const [addNotes, setAddNotes] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // When kind changes, refresh the default question + max_tokens (only if the
  // user hasn't meaningfully edited them yet - we compare against the outgoing
  // default to avoid nuking custom edits).
  const prevKindDefaults = useMemo(() => KIND_DEFAULTS[addKind], [addKind]);
  useEffect(() => {
    setAddQuestion(prevKindDefaults.question);
    setAddMaxTokens(prevKindDefaults.maxTokens);
    setAddSystemPrompt(prevKindDefaults.systemPrompt);
  }, [prevKindDefaults]);

  // Preview what will actually be sent to the model as the TASK block.
  const contextPreview = useMemo(() => {
    const title = (task.title ?? '').trim();
    const description = (task.description ?? '').trim();
    switch (contextSource) {
      case 'TitleOnly':
        return title;
      case 'DescriptionOnly':
        return description;
      case 'TitleAndDescription':
        if (!description) return title;
        if (!title) return description;
        return `${title}\n\n${description}`;
      case 'DescriptionWithTitleFallback':
      default:
        return description || title;
    }
  }, [task.title, task.description, contextSource]);

  useEffect(() => {
    getModelInfo()
      .then(setModelInfo)
      .catch((e: unknown) => setModelInfoError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    listSubtasks(task.id)
      .then((list) => {
        if (cancelled) return;
        setSubtasks(list);
        if (list.length > 0) setSelectedSubtaskId(list[0].id);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSubtasksError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  const loadHistory = useCallback(async (subtaskId: number) => {
    try {
      setHistoryError(null);
      const runs = await listRuns(subtaskId);
      setHistory(runs);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (selectedSubtaskId == null) return;
    setLatestRun(null);
    setRunError(null);
    loadHistory(selectedSubtaskId);
  }, [selectedSubtaskId, loadHistory]);

  const selectedSubtask = subtasks?.find((s) => s.id === selectedSubtaskId) ?? null;

  const handleRun = async () => {
    if (selectedSubtaskId == null || running) return;
    if (!contextPreview) {
      setRunError(
        `The selected context source (${contextSource}) produces an empty string for this task. Pick another source or add a title/description.`,
      );
      return;
    }
    setRunning(true);
    setRunError(null);
    try {
      const run = await runSubtask(selectedSubtaskId, {
        userNotes: runNotes || null,
        contextSource,
      });
      setLatestRun(run);
      setRunNotes('');
      await loadHistory(selectedSubtaskId);
    } catch (e) {
      setRunError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const handleAddSubtask = async () => {
    if (adding) return;
    const q = addQuestion.trim();
    if (!q) {
      setAddError('Question is required.');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const nextOrder = (subtasks?.length ?? 0) + 1;
      const created = await createSubtask(task.id, {
        kind: addKind,
        order: nextOrder,
        question: q,
        temperature: addTemperature,
        maxTokens: addMaxTokens,
        topP: addTopP === '' ? null : Number(addTopP),
        systemPrompt: addSystemPrompt.trim() || null,
        notes: addNotes.trim() || null,
      });
      setSubtasks((prev) => (prev ? [...prev, created] : [created]));
      setSelectedSubtaskId(created.id);
      setShowAdd(false);
      setAddNotes('');
    } catch (e) {
      setAddError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-wide agent-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="agent-modal-header">
          <div>
            <h2>{task.title}</h2>
            <p className="agent-task-id">Task #{task.id}</p>
          </div>
          <button className="btn btn-sm btn-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="agent-model-strip">
          {modelInfoError && (
            <span className="agent-model-error">model-info unreachable: {modelInfoError}</span>
          )}
          {!modelInfoError && !modelInfo && <span className="dim">loading model info...</span>}
          {modelInfo && (
            <>
              <span><strong>Model:</strong> {modelInfo.configuredModel}</span>
              <span>
                <strong>State:</strong>{' '}
                <span className={modelInfo.state === 'loaded' ? 'ok' : 'warn'}>
                  {modelInfo.state ?? '?'}
                </span>
              </span>
              <span><strong>Quant:</strong> {modelInfo.quant ?? '?'}</span>
              <span>
                <strong>ctx:</strong>{' '}
                {modelInfo.loadedContextLength ?? '?'} / {modelInfo.maxContextLength ?? '?'}
              </span>
              {modelInfo.error && (
                <span className="agent-model-error">{modelInfo.error}</span>
              )}
            </>
          )}
        </div>

        {task.description && (
          <section className="agent-section">
            <h3>Task</h3>
            <pre className="agent-task-text">{task.description}</pre>
          </section>
        )}

        <section className="agent-section">
          <div className="agent-section-head">
            <h3>Subtasks</h3>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => {
                setShowAdd((v) => !v);
                setAddError(null);
              }}
              disabled={adding}
            >
              {showAdd ? 'Cancel' : '+ Add Subtask'}
            </button>
          </div>
          {subtasksError && <div className="error-banner">{subtasksError}</div>}
          {!subtasksError && subtasks === null && <div className="dim">loading...</div>}
          {subtasks && subtasks.length === 0 && !showAdd && (
            <div className="dim">
              No subtasks yet. Hit <strong>+ Add Subtask</strong> to create one, or seed data
              from <code>agents/tasks/</code> is imported on backend start.
            </div>
          )}

          {showAdd && (
            <div className="agent-add-form">
              <div className="agent-add-row">
                <label>
                  Kind
                  <select
                    value={addKind}
                    onChange={(e) => setAddKind(e.target.value as SubtaskKind)}
                    disabled={adding}
                  >
                    {SUBTASK_KINDS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Temp
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="2"
                    value={addTemperature}
                    onChange={(e) => setAddTemperature(Number(e.target.value))}
                    disabled={adding}
                  />
                </label>
                <label>
                  Max tokens
                  <input
                    type="number"
                    min="1"
                    max="4096"
                    value={addMaxTokens}
                    onChange={(e) => setAddMaxTokens(Number(e.target.value))}
                    disabled={adding}
                  />
                </label>
                <label>
                  Top-p (optional)
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={addTopP}
                    onChange={(e) => {
                      const v = e.target.value;
                      setAddTopP(v === '' ? '' : Number(v));
                    }}
                    disabled={adding}
                    placeholder="—"
                  />
                </label>
              </div>
              <label className="agent-add-full">
                System prompt (optional — merged into the user message as a
                [SYSTEM] block, because Mistral refuses the system role)
                <textarea
                  rows={4}
                  value={addSystemPrompt}
                  onChange={(e) => setAddSystemPrompt(e.target.value)}
                  disabled={adding}
                  placeholder="Leave blank for no system framing. Defaults per kind."
                />
              </label>
              <label className="agent-add-full">
                Question (this is the prompt; the task text is appended as TASK:)
                <textarea
                  rows={4}
                  value={addQuestion}
                  onChange={(e) => setAddQuestion(e.target.value)}
                  disabled={adding}
                />
              </label>
              <label className="agent-add-full">
                Notes (optional)
                <textarea
                  rows={2}
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  disabled={adding}
                  placeholder="Why this subtask exists / what you're tuning."
                />
              </label>
              {addError && <div className="error-banner">{addError}</div>}
              <div className="agent-add-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleAddSubtask}
                  disabled={adding || !addQuestion.trim()}
                >
                  {adding ? 'Adding...' : 'Add Subtask'}
                </button>
              </div>
            </div>
          )}

          {subtasks && subtasks.length > 0 && (
            <ul className="agent-subtask-list">
              {subtasks.map((s) => (
                <li
                  key={s.id}
                  className={`agent-subtask-item ${s.id === selectedSubtaskId ? 'selected' : ''}`}
                  onClick={() => setSelectedSubtaskId(s.id)}
                >
                  <div className="agent-subtask-head">
                    <span className="agent-subtask-order">#{s.order.toString().padStart(2, '0')}</span>
                    <span className="agent-subtask-kind">{s.kind}</span>
                    {s.systemPrompt && (
                      <span
                        className="agent-subtask-sys"
                        title={s.systemPrompt}
                      >
                        sys
                      </span>
                    )}
                    <span className="agent-subtask-settings">
                      temp={s.temperature} max_tokens={s.maxTokens}
                      {s.topP != null ? ` top_p=${s.topP}` : ''}
                    </span>
                  </div>
                  <div className="agent-subtask-q">{s.question}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selectedSubtask && (
          <section className="agent-section">
            <h3>Run</h3>
            <div className="agent-run-controls">
              <label htmlFor="agent-context-source">
                Task context sent to model
                <select
                  id="agent-context-source"
                  value={contextSource}
                  onChange={(e) => setContextSource(e.target.value as RunContextSource)}
                  disabled={running}
                >
                  {CONTEXT_SOURCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <details className="agent-context-preview">
                <summary className="dim">
                  Preview ({contextPreview.length} chars)
                  {!contextPreview && <span className="warn"> — empty!</span>}
                </summary>
                <pre className="agent-task-text">
                  {contextPreview || '(empty — pick another source or fill in the task)'}
                </pre>
              </details>
              <label htmlFor="agent-notes" className="dim">
                Notes (optional, saved with the run)
              </label>
              <textarea
                id="agent-notes"
                className="agent-notes"
                rows={2}
                value={runNotes}
                onChange={(e) => setRunNotes(e.target.value)}
                placeholder="e.g. 'lowered temperature to 0, added explicit one-sentence rule'"
                disabled={running}
              />
              <button
                className="btn btn-primary"
                onClick={handleRun}
                disabled={running || modelInfo?.state !== 'loaded' || !contextPreview}
                title={
                  modelInfo?.state !== 'loaded'
                    ? 'Load the model in LM Studio first'
                    : !contextPreview
                      ? 'Context source is empty for this task'
                      : undefined
                }
              >
                {running ? 'Running...' : `Run ${selectedSubtask.kind}`}
              </button>
            </div>

            {runError && <div className="error-banner">{runError}</div>}

            {latestRun && (
              <div className="agent-run-result">
                <div className="agent-run-stats">
                  <span>
                    <strong>stop:</strong>{' '}
                    <span className={latestRun.stopReason === 'eosFound' ? 'ok' : 'warn'}>
                      {latestRun.stopReason ?? '?'}
                    </span>
                  </span>
                  <span>
                    <strong>tok/s:</strong>{' '}
                    {latestRun.tokensPerSecond != null
                      ? latestRun.tokensPerSecond.toFixed(1)
                      : '?'}
                  </span>
                  <span>
                    <strong>ttft:</strong>{' '}
                    {latestRun.timeToFirstToken != null
                      ? `${latestRun.timeToFirstToken.toFixed(2)}s`
                      : '?'}
                  </span>
                  <span>
                    <strong>in/out:</strong> {latestRun.promptTokens ?? '?'} / {latestRun.completionTokens ?? '?'}
                  </span>
                  <span>
                    <strong>sys:</strong>{' '}
                    {latestRun.systemPrompt ? (
                      <span className="ok">yes</span>
                    ) : (
                      <span className="dim">none</span>
                    )}
                  </span>
                </div>
                {latestRun.systemPrompt && (
                  <details className="agent-run-sys">
                    <summary className="dim">System prompt in effect</summary>
                    <pre className="agent-task-text">{latestRun.systemPrompt}</pre>
                  </details>
                )}
                <pre className="agent-response">{latestRun.responseContent || '(empty response)'}</pre>
              </div>
            )}
          </section>
        )}

        {selectedSubtask && (
          <section className="agent-section">
            <h3>History ({history.length})</h3>
            {historyError && <div className="error-banner">{historyError}</div>}
            {history.length === 0 ? (
              <div className="dim">No runs yet for this subtask.</div>
            ) : (
              <ul className="agent-history-list">
                {history.map((r) => (
                  <li key={r.id} className="agent-history-item">
                    <div className="agent-history-head">
                      <span className="dim">
                        {new Date(r.startedAt).toLocaleString()}
                      </span>
                      <span className="dim">
                        temp={r.sentTemperature} max_tokens={r.sentMaxTokens}
                      </span>
                      <span className={r.stopReason === 'eosFound' ? 'ok' : 'warn'}>
                        {r.stopReason ?? '?'}
                      </span>
                      <span className="dim">
                        {r.promptTokens ?? '?'}/{r.completionTokens ?? '?'} toks
                      </span>
                      {r.systemPrompt ? (
                        <span className="agent-history-sys" title={r.systemPrompt}>sys</span>
                      ) : (
                        <span className="dim" title="No system framing was sent">no sys</span>
                      )}
                    </div>
                    <pre className="agent-history-content">{r.responseContent}</pre>
                    {r.userNotes && <div className="agent-history-notes">{r.userNotes}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
