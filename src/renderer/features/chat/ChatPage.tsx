import { useEffect, useRef, useState } from 'react';
import type {
  AgentId,
  AiPickOption,
  ConflictResolutionChoice,
  FileConflictVM,
  MessageRecord,
  OrchestrationEventPayload,
  OrchestrationLogEntry,
  ProjectRecord,
  StepVM,
} from '@shared/ipc';
import { Composer } from '../../components/Composer';
import { PlanCard } from '../../components/PlanCard';
import { SystemLine } from '../../components/SystemLine';
import { t } from '../../i18n';
import { getBridge } from '../../lib/bridge';
import { ConflictDialog } from './ConflictDialog';
import { OrchestrationLog, type DecisionReason } from './OrchestrationLog';
import { PausedCard } from './PausedCard';
import { PermissionDialog, type PermissionRequestData } from './PermissionDialog';
import { PreviewTab } from './PreviewTab';
import { StepCodeTab } from './StepCodeTab';

export interface ChatPageProps {
  readonly project: ProjectRecord;
  readonly initialConversationId?: string;
  readonly onOpenDirectEdit?: () => void;
  readonly initialActiveStepId?: string | null;
}

type RightTab = 'preview' | 'code' | 'detail';

export function ChatPage({
  project,
  initialConversationId,
  onOpenDirectEdit,
  initialActiveStepId,
}: ChatPageProps): React.JSX.Element {
  const bridge = getBridge();
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId ?? null,
  );
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [steps, setSteps] = useState<StepVM[]>([]);
  const [systemLines, setSystemLines] = useState<string[]>([]);
  const [reasons, setReasons] = useState<DecisionReason[]>([]);
  const [logEntries, setLogEntries] = useState<OrchestrationLogEntry[]>([]);

  const [running, setRunning] = useState(false);
  const [aiPick, setAiPick] = useState<string>('auto');
  const [activeStepId, setActiveStepId] = useState<string | null>(initialActiveStepId ?? null);
  const [pausedStepSeq, setPausedStepSeq] = useState<number | null>(null);
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequestData | null>(null);
  const [conflict, setConflict] = useState<FileConflictVM | null>(null);

  const [rightTab, setRightTab] = useState<RightTab>(initialActiveStepId ? 'code' : 'detail');
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  // Khởi tạo hoặc nạp hội thoại
  useEffect(() => {
    let mounted = true;
    async function initConversation(): Promise<void> {
      let targetConvId = conversationId;
      if (!targetConvId) {
        const listRes = await bridge.conversations.list(project.id);
        if (listRes.ok && listRes.data.length > 0) {
          targetConvId = listRes.data[0].id;
        } else {
          const createRes = await bridge.conversations.create({
            projectId: project.id,
            title: 'Hội thoại ban đầu',
          });
          if (createRes.ok) {
            targetConvId = createRes.data.id;
          }
        }
      }

      if (targetConvId && mounted) {
        setConversationId(targetConvId);
        const [msgsRes, stepsRes] = await Promise.all([
          bridge.conversations.messages(targetConvId),
          bridge.conversations.steps(targetConvId),
        ]);
        if (mounted && msgsRes.ok) setMessages(msgsRes.data);
        if (mounted && stepsRes.ok) setSteps(stepsRes.data);
      }
    }

    void initConversation();
    return () => {
      mounted = false;
    };
  }, [bridge, project.id, conversationId]);

  // Đăng ký nhận sự kiện orchestrator thời gian thực
  useEffect(() => {
    const unsubscribe = bridge.orchestrator.onEvent((payload: OrchestrationEventPayload) => {
      if (conversationId && payload.conversationId !== conversationId) return;

      switch (payload.type) {
        case 'message_added': {
          const newMsg = payload.data as MessageRecord;
          setMessages((prev) => [...prev, newMsg]);
          break;
        }
        case 'step_updated': {
          const updatedStep = payload.data as StepVM;
          setSteps((prev) => {
            const idx = prev.findIndex((s) => s.id === updatedStep.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = updatedStep;
              return next;
            }
            return [...prev, updatedStep];
          });
          break;
        }
        case 'system_line': {
          const data = payload.data as { text: string };
          setSystemLines((prev) => [...prev, data.text]);
          break;
        }
        case 'log_entry': {
          const entry = payload.data as OrchestrationLogEntry;
          setLogEntries((prev) => [...prev, entry]);
          if (entry.source.toLowerCase().includes('điều phối') || entry.source === 'orchestrator') {
            if (entry.text.includes('→')) {
              setReasons((prev) => [
                ...prev,
                { title: entry.text, reason: `Ghi nhận lúc ${entry.at}` },
              ]);
            }
          }
          break;
        }
        case 'permission_requested': {
          const perm = payload.data as PermissionRequestData;
          setPermissionRequest(perm);
          break;
        }
        case 'conflict_detected': {
          const data = payload.data as FileConflictVM;
          setConflict(data);
          break;
        }
        case 'execution_paused': {
          const data = payload.data as { stepSeq: number };
          setPausedStepSeq(data.stepSeq);
          setRunning(false);
          break;
        }
        case 'execution_done':
        case 'execution_stopped': {
          setRunning(false);
          break;
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [bridge, conversationId]);

  // Cuộn xuống khi có tin mới
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, steps, systemLines, pausedStepSeq]);

  const handleSend = async (content: string): Promise<void> => {
    if (!conversationId || running) return;
    setRunning(true);
    setPausedStepSeq(null);
    const aiPickOption: AiPickOption | undefined =
      aiPick === 'auto' ? { type: 'auto' } : { type: 'agent', agentId: aiPick as AgentId };

    await bridge.orchestrator.send({
      conversationId,
      prompt: content,
      aiPick: aiPickOption,
    });
  };

  const handleStop = async (): Promise<void> => {
    if (!conversationId) return;
    await bridge.orchestrator.cancel(conversationId);
    setRunning(false);
  };

  const handleRespondPermission = async (allowed: boolean): Promise<void> => {
    if (!conversationId || !permissionRequest) return;
    await bridge.permission.respond({
      conversationId,
      requestId: permissionRequest.requestId,
      allowed,
    });
    setPermissionRequest(null);
  };

  const handleResolveConflict = async (choice: ConflictResolutionChoice): Promise<void> => {
    if (!conflict) return;
    await bridge.conflict.resolve({
      projectId: conflict.projectId,
      stepId: conflict.stepId,
      filePath: conflict.filePath,
      choice,
      userVersion: conflict.userVersion,
      aiVersion: conflict.aiVersion,
    });
    setConflict(null);
  };

  const handleRetryPaused = async (): Promise<void> => {
    if (!conversationId) return;
    setPausedStepSeq(null);
    setRunning(true);
    const aiPickOption: AiPickOption | undefined =
      aiPick === 'auto' ? { type: 'auto' } : { type: 'agent', agentId: aiPick as AgentId };

    await bridge.orchestrator.send({
      conversationId,
      prompt: 'Thử lại bước đang tạm dừng',
      aiPick: aiPickOption,
    });
  };

  const isEmptyChat = messages.length === 0;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* KHUNG TRÁI: VÙNG CHAT CHÍNH */}
      <main className="flex-1 flex flex-col min-w-0 bg-cf-bg border-r border-border">
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4">
          {isEmptyChat ? (
            /* TRẠNG THÁI CHAT TRỐNG (MH-12) */
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12">
              <div className="w-14 h-14 rounded-2xl bg-primary-soft flex items-center justify-center text-2xl text-primary font-bold mb-3 select-none">
                ✦
              </div>
              <h2 className="text-xl font-bold text-cf-text mb-1">{t('mh03.empty.title')}</h2>
              <p className="text-muted text-small mb-6 leading-relaxed">
                {t('mh03.empty.description')}
              </p>

              <div className="flex flex-col gap-2 w-full">
                <button
                  type="button"
                  onClick={() => void handleSend(t('mh03.empty.prompt1'))}
                  className="px-4 py-2.5 rounded-full border border-border bg-surface text-small text-cf-text hover:border-primary/60 hover:bg-surface-2 transition-colors cursor-pointer text-left"
                >
                  {t('mh03.empty.prompt1')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend(t('mh03.empty.prompt2'))}
                  className="px-4 py-2.5 rounded-full border border-border bg-surface text-small text-cf-text hover:border-primary/60 hover:bg-surface-2 transition-colors cursor-pointer text-left"
                >
                  {t('mh03.empty.prompt2')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend(t('mh03.empty.prompt3'))}
                  className="px-4 py-2.5 rounded-full border border-border bg-surface text-small text-cf-text hover:border-primary/60 hover:bg-surface-2 transition-colors cursor-pointer text-left"
                >
                  {t('mh03.empty.prompt3')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) =>
                msg.role === 'user' ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[80%] bg-primary text-white p-3.5 rounded-2xl rounded-tr-sm text-small leading-relaxed shadow-sm">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-soft text-primary font-bold flex items-center justify-center flex-none select-none text-small">
                      CF
                    </div>
                    <div className="flex-1 max-w-[85%] bg-surface border border-border p-4 rounded-2xl rounded-tl-sm text-small text-cf-text leading-relaxed shadow-sm">
                      {msg.content}
                    </div>
                  </div>
                ),
              )}

              {/* THẺ KẾ HOẠCH (PLAN CARD) */}
              {steps.length > 0 && (
                <PlanCard
                  steps={steps}
                  activeStepId={activeStepId}
                  onViewCode={(stepId) => {
                    setActiveStepId(stepId);
                    setRightTab('code');
                    setIsRightCollapsed(false);
                  }}
                />
              )}

              {/* CÁC DÒNG SYSTEM LINE */}
              {systemLines.map((line, idx) => (
                <SystemLine key={idx} text={line} tone="warn" />
              ))}

              {/* THẺ TẠM DỪNG (PAUSED CARD - MH-07) */}
              {pausedStepSeq && (
                <PausedCard
                  stepSeq={pausedStepSeq}
                  onRetry={() => void handleRetryPaused()}
                  onPickOtherAgent={() => setRightTab('detail')}
                />
              )}
            </>
          )}
        </div>

        {/* COMPOSER */}
        <Composer
          running={running}
          aiPick={aiPick}
          onAiPickChange={setAiPick}
          onSend={(content) => void handleSend(content)}
          onStop={() => void handleStop()}
        />
      </main>

      {/* KHUNG PHẢI: 3 TABS (XEM TRƯỚC, CODE, ĐIỀU PHỐI CHI TIẾT) */}
      {isRightCollapsed ? (
        <aside className="w-10 bg-surface-2 border-l border-border flex flex-col items-center py-3">
          <button
            type="button"
            title={t('mh03.tabs.expandAria')}
            aria-label={t('mh03.tabs.expandAria')}
            onClick={() => setIsRightCollapsed(false)}
            className="p-1.5 rounded hover:bg-line text-muted cursor-pointer"
          >
            ⇤
          </button>
        </aside>
      ) : (
        <aside className="w-96 lg:w-[440px] flex-none bg-surface flex flex-col border-l border-border overflow-hidden">
          {/* Header tabs */}
          <div className="flex items-center justify-between p-3 border-b border-line bg-surface-2/30">
            <div className="flex gap-1" role="tablist" aria-label={t('mh03.tabs.ariaLabel')}>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === 'preview'}
                onClick={() => setRightTab('preview')}
                className={`px-3 py-1.5 rounded-md text-small font-medium transition-colors ${
                  rightTab === 'preview'
                    ? 'bg-surface text-cf-text shadow-sm'
                    : 'text-muted hover:text-cf-text'
                }`}
              >
                {t('mh03.tabs.preview')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === 'code'}
                onClick={() => setRightTab('code')}
                className={`px-3 py-1.5 rounded-md text-small font-medium transition-colors ${
                  rightTab === 'code'
                    ? 'bg-surface text-cf-text shadow-sm'
                    : 'text-muted hover:text-cf-text'
                }`}
              >
                {t('mh03.tabs.code')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === 'detail'}
                onClick={() => setRightTab('detail')}
                className={`px-3 py-1.5 rounded-md text-small font-medium transition-colors ${
                  rightTab === 'detail'
                    ? 'bg-surface text-cf-text shadow-sm'
                    : 'text-muted hover:text-cf-text'
                }`}
              >
                {t('mh03.tabs.detail')}
              </button>
            </div>

            <button
              type="button"
              title={t('mh03.tabs.collapseAria')}
              aria-label={t('mh03.tabs.collapseAria')}
              onClick={() => setIsRightCollapsed(true)}
              className="text-small text-muted hover:text-cf-text p-1 cursor-pointer"
            >
              {t('mh03.tabs.collapse')}
            </button>
          </div>

          {/* Nội dung tab */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0">
            {rightTab === 'preview' && <PreviewTab projectId={project.id} />}

            {rightTab === 'code' && (
              <StepCodeTab
                step={
                  steps.find((s) => s.id === activeStepId) ?? (steps.length > 0 ? steps[0] : null)
                }
                projectId={project.id}
                onAskSnippet={(snippet) => {
                  void handleSend(`Giải thích đoạn mã này giúp tôi:\n\`\`\`\n${snippet}\n\`\`\``);
                }}
                onDirectEditClick={onOpenDirectEdit}
                onStepUndone={(stepId) => {
                  setSteps((prev) =>
                    prev.map((s) => (s.id === stepId ? { ...s, status: 'undone' } : s)),
                  );
                }}
                onStepRedone={(stepId) => {
                  setSteps((prev) =>
                    prev.map((s) => (s.id === stepId ? { ...s, status: 'done' } : s)),
                  );
                }}
              />
            )}

            {rightTab === 'detail' && (
              <OrchestrationLog reasons={reasons} logEntries={logEntries} />
            )}
          </div>
        </aside>
      )}

      {/* HỘP THOẠI XIN PHÉP RỦI RO B5 (MH-04) */}
      <PermissionDialog
        request={permissionRequest}
        onRespond={(granted) => void handleRespondPermission(granted)}
      />

      {/* HỘP THOẠI XUNG ĐỘT CODE (MH-05) */}
      <ConflictDialog
        conflict={conflict}
        onResolve={(choice) => void handleResolveConflict(choice)}
        onClose={() => setConflict(null)}
      />
    </div>
  );
}
