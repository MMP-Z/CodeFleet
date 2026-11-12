import { useCallback, useEffect, useRef, useState } from 'react';
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
  WorkspaceFileNode,
} from '@shared/ipc';
import { CodeViewer } from '../../components/CodeViewer';
import { Composer } from '../../components/Composer';
import { FileTree } from '../../components/FileTree';
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
  readonly onNavigateToQuota?: () => void;
  readonly initialActiveStepId?: string | null;
}

export type CenterTab = 'file' | 'diff' | 'preview' | 'log';

function findFirstCodeFile(nodes: readonly WorkspaceFileNode[]): WorkspaceFileNode | null {
  for (const n of nodes) {
    if (!n.isDirectory) return n;
    if (n.children && n.children.length > 0) {
      const found = findFirstCodeFile(n.children);
      if (found) return found;
    }
  }
  return null;
}

export function ChatPage({
  project,
  initialConversationId,
  onOpenDirectEdit,
  onNavigateToQuota,
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

  // Trạng thái Workspace / Cây thư mục và Code Viewer
  const [workspaceFiles, setWorkspaceFiles] = useState<readonly WorkspaceFileNode[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLanguage, setFileLanguage] = useState<string>('javascript');
  const [centerTab, setCenterTab] = useState<CenterTab>(initialActiveStepId ? 'diff' : 'file');
  const [isFileTreeCollapsed, setIsFileTreeCollapsed] = useState(false);

  const handleSelectFile = useCallback(
    async (filePath: string): Promise<void> => {
      setActiveFilePath(filePath);
      setCenterTab('file');
      try {
        const res = await bridge.workspace.readFile(project.id, filePath);
        if (res.ok) {
          setFileContent(res.data.content);
          setFileLanguage(res.data.language);
        } else {
          setFileContent(`// Không thể đọc file: ${res.error.message}`);
        }
      } catch {
        setFileContent('// Lỗi đọc file');
      }
    },
    [bridge, project.id],
  );

  // Nạp cây thư mục dự án
  const loadWorkspaceTree = useCallback(async (): Promise<void> => {
    try {
      const res = await bridge.workspace.tree(project.id);
      if (res.ok) {
        setWorkspaceFiles(res.data.files);
        if (!activeFilePath && res.data.files.length > 0) {
          const first = findFirstCodeFile(res.data.files);
          if (first) {
            void handleSelectFile(first.path);
          }
        }
      }
    } catch (err) {
      console.error('Lỗi nạp cây thư mục:', err);
    }
  }, [bridge, project.id, activeFilePath, handleSelectFile]);

  useEffect(() => {
    void loadWorkspaceTree();
  }, [loadWorkspaceTree]);

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
        if (mounted && stepsRes.ok) {
          setSteps(stepsRes.data);
          const paused = stepsRes.data.find((s) => s.status === 'paused');
          if (paused) {
            setPausedStepSeq(paused.seq);
          }
        }
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
          // Tự động làm mới cây thư mục nếu AI vừa tạo/sửa file
          void loadWorkspaceTree();
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
          setPermissionRequest(payload.data as PermissionRequestData);
          break;
        }
        case 'conflict_detected': {
          setConflict(payload.data as FileConflictVM);
          break;
        }
        case 'execution_done': {
          setRunning(false);
          void loadWorkspaceTree();
          break;
        }
        case 'execution_stopped': {
          setRunning(false);
          break;
        }
        case 'execution_paused': {
          setRunning(false);
          const data = payload.data as { stepSeq?: number };
          setPausedStepSeq(data?.stepSeq ?? 1);
          break;
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [bridge, conversationId, loadWorkspaceTree]);

  // Tự cuộn chat xuống cuối khi có tin nhắn mới
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, steps, systemLines]);

  const handleSend = async (promptText: string): Promise<void> => {
    if (!conversationId || running) return;

    const userMsg: MessageRecord = {
      id: `client-${Date.now()}`,
      conversationId,
      role: 'user',
      content: promptText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setRunning(true);

    const aiPickOption: AiPickOption | undefined =
      aiPick === 'auto' ? { type: 'auto' } : { type: 'agent', agentId: aiPick as AgentId };

    try {
      const res = await bridge.orchestrator.send({
        conversationId,
        prompt: promptText,
        aiPick: aiPickOption,
      });
      if (!res.ok) {
        setRunning(false);
        setSystemLines((prev) => [...prev, `Lỗi gửi yêu cầu: ${res.error.message}`]);
      }
    } catch (err) {
      setRunning(false);
      setSystemLines((prev) => [...prev, `Lỗi không xác định: ${String(err)}`]);
    }
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
    <div className="flex-1 flex overflow-hidden min-h-0 bg-cf-bg select-none">
      {/* =========================================================
          CỘT 1: CHAT PANEL (TRÁI) — Phong cách Agent Thread của Zed
          ========================================================= */}
      <section className="w-80 lg:w-96 flex-none flex flex-col border-r border-border bg-surface overflow-hidden">
        {/* Agent Thread Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-surface-2/40 text-xs select-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <strong className="text-muted tracking-wider uppercase text-[11px] font-bold">
              Agent Thread
            </strong>
          </div>
          <span className="text-[11px] text-muted font-mono">{messages.length} tin</span>
        </div>

        {/* Message stream */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
          {isEmptyChat ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center max-w-xs mx-auto py-8">
              <div className="w-12 h-12 rounded-2xl bg-primary-soft flex items-center justify-center text-2xl text-primary font-bold mb-3 select-none">
                ✦
              </div>
              <h2 className="text-base font-bold text-cf-text mb-1">{t('mh03.empty.title')}</h2>
              <p className="text-muted text-xs mb-5 leading-relaxed">
                {t('mh03.empty.description')}
              </p>

              <div className="flex flex-col gap-2 w-full">
                <button
                  type="button"
                  onClick={() => void handleSend(t('mh03.empty.prompt1'))}
                  className="px-3 py-2 rounded-lg border border-border bg-surface text-xs text-cf-text hover:border-primary/60 hover:bg-surface-2 transition-colors cursor-pointer text-left font-mono"
                >
                  {t('mh03.empty.prompt1')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend(t('mh03.empty.prompt2'))}
                  className="px-3 py-2 rounded-lg border border-border bg-surface text-xs text-cf-text hover:border-primary/60 hover:bg-surface-2 transition-colors cursor-pointer text-left font-mono"
                >
                  {t('mh03.empty.prompt2')}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend(t('mh03.empty.prompt3'))}
                  className="px-3 py-2 rounded-lg border border-border bg-surface text-xs text-cf-text hover:border-primary/60 hover:bg-surface-2 transition-colors cursor-pointer text-left font-mono"
                >
                  {t('mh03.empty.prompt3')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) =>
                msg.role === 'user' ? (
                  <div key={msg.id} className="flex justify-end select-text">
                    <div className="max-w-[85%] bg-primary text-white p-3 rounded-2xl rounded-tr-xs text-small leading-relaxed shadow-sm font-sans">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex items-start gap-2.5 select-text">
                    <div className="w-7 h-7 rounded-full bg-primary-soft text-primary font-bold flex items-center justify-center flex-none select-none text-xs">
                      CF
                    </div>
                    <div className="flex-1 max-w-[88%] bg-surface-2 border border-border p-3.5 rounded-2xl rounded-tl-xs text-small text-cf-text leading-relaxed shadow-sm font-sans">
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
                    setCenterTab('diff');
                    void bridge.code.stepDiff(stepId).then((res) => {
                      if (res.ok && res.data.files.length > 0) {
                        void handleSelectFile(res.data.files[0].path);
                      }
                    });
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
                  onPickOtherAgent={() => setCenterTab('log')}
                  onViewQuota={onNavigateToQuota}
                />
              )}
            </>
          )}
        </div>

        {/* COMPOSER NHẬP TIN NHẮN */}
        <Composer
          running={running}
          aiPick={aiPick}
          onAiPickChange={setAiPick}
          onSend={(content) => void handleSend(content)}
          onStop={() => void handleStop()}
        />
      </section>

      {/* =========================================================
          CỘT 2: CODE VIEWER (GIỮA) — Không gian trọng tâm của IDE
          ========================================================= */}
      <main className="flex-1 flex flex-col min-w-0 bg-surface overflow-hidden border-r border-border">
        {centerTab === 'file' ? (
          activeFilePath ? (
            <CodeViewer
              filePath={activeFilePath}
              content={fileContent ?? '// Đang tải nội dung...'}
              language={fileLanguage}
              onAskSnippet={(snippet) => {
                void handleSend(`Giải thích đoạn mã này giúp tôi:\n\`\`\`\n${snippet}\n\`\`\``);
              }}
              activeTab={centerTab}
              onTabChange={setCenterTab}
              hasDiff={steps.length > 0}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted gap-3">
              <span className="text-4xl">💻</span>
              <p className="text-small font-medium text-text">
                Chọn một file từ cây thư mục bên phải để xem code
              </p>
              <p className="text-xs text-muted max-w-sm">
                Bạn có thể duyệt toàn bộ file trong dự án hoặc theo dõi code do AI chỉnh sửa trực
                tiếp tại đây.
              </p>
            </div>
          )
        ) : centerTab === 'diff' ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-surface">
            {/* Header tab navigation */}
            <div className="flex items-center gap-1 border-b border-border bg-surface-2/40 px-3 pt-2">
              {activeFilePath && (
                <button
                  type="button"
                  onClick={() => setCenterTab('file')}
                  className="px-3 py-1.5 text-xs text-muted hover:text-text cursor-pointer font-mono"
                >
                  📄 {activeFilePath.split('/').pop()}
                </button>
              )}
              <button
                type="button"
                className="px-3 py-1.5 text-xs bg-surface border-t border-x border-border font-semibold text-text rounded-t flex items-center gap-1"
              >
                <span>⚡</span>
                <span>{t('mh03.tabs.code')} (Diff)</span>
              </button>
              <button
                type="button"
                onClick={() => setCenterTab('preview')}
                className="px-3 py-1.5 text-xs text-muted hover:text-text cursor-pointer flex items-center gap-1"
              >
                <span>🌐</span>
                <span>{t('mh03.tabs.preview')}</span>
              </button>
              <button
                type="button"
                onClick={() => setCenterTab('log')}
                className="px-3 py-1.5 text-xs text-muted hover:text-text cursor-pointer flex items-center gap-1"
              >
                <span>📜</span>
                <span>{t('mh03.tabs.detail')}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
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
            </div>
          </div>
        ) : centerTab === 'preview' ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-surface">
            {/* Header tab navigation */}
            <div className="flex items-center gap-1 border-b border-border bg-surface-2/40 px-3 pt-2">
              {activeFilePath && (
                <button
                  type="button"
                  onClick={() => setCenterTab('file')}
                  className="px-3 py-1.5 text-xs text-muted hover:text-text cursor-pointer font-mono"
                >
                  📄 {activeFilePath.split('/').pop()}
                </button>
              )}
              {steps.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCenterTab('diff')}
                  className="px-3 py-1.5 text-xs text-muted hover:text-text cursor-pointer flex items-center gap-1"
                >
                  <span>⚡</span>
                  <span>{t('mh03.tabs.code')} (Diff)</span>
                </button>
              )}
              <button
                type="button"
                className="px-3 py-1.5 text-xs bg-surface border-t border-x border-border font-semibold text-text rounded-t flex items-center gap-1"
              >
                <span>🌐</span>
                <span>{t('mh03.tabs.preview')}</span>
              </button>
              <button
                type="button"
                onClick={() => setCenterTab('log')}
                className="px-3 py-1.5 text-xs text-muted hover:text-text cursor-pointer flex items-center gap-1"
              >
                <span>📜</span>
                <span>{t('mh03.tabs.detail')}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <PreviewTab projectId={project.id} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden bg-surface">
            {/* Header tab navigation */}
            <div className="flex items-center gap-1 border-b border-border bg-surface-2/40 px-3 pt-2">
              {activeFilePath && (
                <button
                  type="button"
                  onClick={() => setCenterTab('file')}
                  className="px-3 py-1.5 text-xs text-muted hover:text-text cursor-pointer font-mono"
                >
                  📄 {activeFilePath.split('/').pop()}
                </button>
              )}
              {steps.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCenterTab('diff')}
                  className="px-3 py-1.5 text-xs text-muted hover:text-text cursor-pointer flex items-center gap-1"
                >
                  <span>⚡</span>
                  <span>{t('mh03.tabs.code')} (Diff)</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setCenterTab('preview')}
                className="px-3 py-1.5 text-xs text-muted hover:text-text cursor-pointer flex items-center gap-1"
              >
                <span>🌐</span>
                <span>{t('mh03.tabs.preview')}</span>
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-xs bg-surface border-t border-x border-border font-semibold text-text rounded-t flex items-center gap-1"
              >
                <span>📜</span>
                <span>{t('mh03.tabs.detail')}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <OrchestrationLog reasons={reasons} logEntries={logEntries} />
            </div>
          </div>
        )}
      </main>

      {/* =========================================================
          CỘT 3: FILE TREE EXPLORER (PHẢI) — Cây thư mục dự án
          ========================================================= */}
      <FileTree
        files={workspaceFiles}
        activeFilePath={activeFilePath}
        modifiedFiles={[]}
        onSelectFile={(path) => void handleSelectFile(path)}
        onRefresh={() => void loadWorkspaceTree()}
        projectName={project.name}
        isCollapsed={isFileTreeCollapsed}
        onToggleCollapse={() => setIsFileTreeCollapsed((prev) => !prev)}
      />

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
