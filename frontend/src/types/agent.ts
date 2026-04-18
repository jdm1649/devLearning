export type SubtaskKind =
  | 'Restate'
  | 'ExpectedBehavior'
  | 'ActualBehavior'
  | 'Categorize'
  | 'FirstDiagnosticStep'
  | 'NextDiagnosticStep'
  | 'ConfirmationPlan';

export const SUBTASK_KINDS: SubtaskKind[] = [
  'Restate',
  'ExpectedBehavior',
  'ActualBehavior',
  'Categorize',
  'FirstDiagnosticStep',
  'NextDiagnosticStep',
  'ConfirmationPlan',
];

/// Which part of the parent task is embedded in the prompt.
export type RunContextSource =
  | 'DescriptionWithTitleFallback'
  | 'TitleOnly'
  | 'DescriptionOnly'
  | 'TitleAndDescription';

export interface CreateSubtaskRequest {
  kind: SubtaskKind;
  order: number;
  question: string;
  temperature: number;
  maxTokens: number;
  topP: number | null;
  systemPrompt: string | null;
  notes: string | null;
}

export interface Subtask {
  id: number;
  taskItemId: number;
  kind: SubtaskKind;
  order: number;
  question: string;
  temperature: number;
  maxTokens: number;
  topP: number | null;
  systemPrompt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubtaskRun {
  id: number;
  subtaskId: number;
  startedAt: string;
  model: string;
  sentMessagesJson: string;
  sentTemperature: number;
  sentMaxTokens: number;
  sentTopP: number | null;
  systemPrompt: string | null;
  responseContent: string;
  stopReason: string | null;
  tokensPerSecond: number | null;
  timeToFirstToken: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  quant: string | null;
  contextLength: number | null;
  runtime: string | null;
  userNotes: string | null;
}

export interface ModelInfo {
  configuredModel: string;
  state: string | null;
  quant: string | null;
  loadedContextLength: number | null;
  maxContextLength: number | null;
  reachable: boolean;
  error: string | null;
}

export interface RunSubtaskError {
  error: string;
  message: string;
  estimatedTokens?: number;
  maxPromptTokens?: number;
}
