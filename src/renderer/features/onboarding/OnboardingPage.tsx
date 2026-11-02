import React, { useCallback, useEffect, useState } from 'react';
import type { DetectResult } from '@shared/agents';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Pill } from '../../components/Pill';
import { t } from '../../i18n';
import { getBridge } from '../../lib/bridge';

export interface OnboardingPageProps {
  readonly onCompleted?: () => void;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onCompleted }) => {
  const bridge = getBridge();

  const [detecting, setDetecting] = useState<boolean>(true);
  const [agents, setAgents] = useState<DetectResult[]>([]);
  const [gitStatus, setGitStatus] = useState<{ available: boolean; version: string | null } | null>(
    null,
  );
  const [skippedAgents, setSkippedAgents] = useState<Set<string>>(new Set());
  const [copiedAgentId, setCopiedAgentId] = useState<string | null>(null);

  const checkAll = useCallback(async () => {
    setDetecting(true);
    try {
      const [detectRes, gitRes] = await Promise.all([
        bridge.agents.detectAll(),
        bridge.system.checkGit(),
      ]);
      if (detectRes.ok) {
        setAgents(detectRes.data);
      }
      if (gitRes.ok) {
        setGitStatus(gitRes.data);
      }
    } finally {
      setDetecting(false);
    }
  }, [bridge]);

  useEffect(() => {
    void checkAll();
  }, [checkAll]);

  // Tự động kiểm tra lại khi cửa sổ app được focus trở lại (UI_SPEC MH-01)
  useEffect(() => {
    const handleFocus = () => {
      void checkAll();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [checkAll]);

  const handleOpenLogin = async (agentId: string) => {
    await bridge.agents.openLogin(agentId);
  };

  const handleOpenDocs = async (agentId: string) => {
    await bridge.agents.openDocs(agentId);
  };

  const handleCopyCommand = async (agentId: string, cmd: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedAgentId(agentId);
      setTimeout(() => {
        setCopiedAgentId(null);
      }, 2000);
    } catch {
      // Fallback nếu clipboard API bị từ chối
    }
  };

  const handleToggleSkip = (agentId: string) => {
    setSkippedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  const readyAgents = agents.filter((a) => a.status === 'ready');
  const installedCount = agents.filter((a) => a.installed).length;
  const totalCount = agents.length;
  const canContinue = readyAgents.length > 0;

  const handleContinue = async () => {
    if (!canContinue) return;
    await bridge.settings.set({ key: 'onboarding.completed', value: true });
    onCompleted?.();
  };

  const continueLabel =
    readyAgents.length === 1
      ? t('mh01.continueWith', {
          name: readyAgents[0]?.shortName ?? readyAgents[0]?.displayName ?? '',
        })
      : t('mh01.continueGeneral');

  return (
    <div className="flex-1 w-full max-w-[840px] mx-auto px-6 py-8 flex flex-col gap-6">
      {/* Stepper */}
      <div className="flex items-center gap-2 flex-wrap" aria-label={t('mh01.stepperAria')}>
        <div className="flex items-center gap-2 text-cf-muted text-xs font-medium">
          <span className="w-6 h-6 rounded-full bg-cf-ok-bg text-cf-ok-ink flex items-center justify-center font-bold">
            ✓
          </span>
          <span>{t('mh01.step1')}</span>
        </div>
        <span className="w-7 h-[1px] bg-cf-border self-center" />
        <div className="flex items-center gap-2 text-cf-text text-xs font-semibold">
          <span className="w-6 h-6 rounded-full bg-cf-primary text-white flex items-center justify-center font-bold">
            2
          </span>
          <span>{t('mh01.step2')}</span>
        </div>
        <span className="w-7 h-[1px] bg-cf-border self-center" />
        <div className="flex items-center gap-2 text-cf-muted text-xs">
          <span className="w-6 h-6 rounded-full bg-cf-line flex items-center justify-center font-bold">
            3
          </span>
          <span>{t('mh01.step3')}</span>
        </div>
      </div>

      {/* Tiêu đề & mô tả */}
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">{t('mh01.title')}</h1>
        <p className="text-sm text-cf-muted leading-relaxed">{t('mh01.description')}</p>
      </div>

      {/* Thẻ danh sách CLI */}
      <div className="bg-cf-surface border border-cf-line rounded-cf-card shadow-cf-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-cf-surface border-b border-cf-line">
          <span className="text-xs uppercase tracking-wider text-cf-muted font-bold font-mono">
            {t('mh01.summaryCount', {
              installed: installedCount,
              total: totalCount,
              ready: readyAgents.length,
            })}
          </span>
          <Button variant="default" size="sm" onClick={() => void checkAll()} disabled={detecting}>
            {detecting ? t('common.loading') : t('mh01.recheck')}
          </Button>
        </div>

        <div className="divide-y divide-cf-line">
          {agents.map((agent) => {
            const isSkipped = skippedAgents.has(agent.agentId);
            const pillTone =
              agent.status === 'ready'
                ? 'ok'
                : agent.status === 'not_logged_in'
                  ? 'warn'
                  : agent.status === 'error'
                    ? 'danger'
                    : 'wait';

            const pillLabel =
              agent.status === 'ready'
                ? t('mh01.status.ready')
                : agent.status === 'not_logged_in'
                  ? t('mh01.status.notLoggedIn')
                  : agent.status === 'error'
                    ? t('mh01.status.error')
                    : t('mh01.status.notInstalled');

            return (
              <div
                key={agent.agentId}
                className={`p-4 flex gap-3.5 items-start flex-wrap transition-opacity ${
                  isSkipped ? 'opacity-60' : 'opacity-100'
                }`}
              >
                {/* Logo badge */}
                <div
                  className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white font-bold text-base shrink-0 shadow-sm"
                  style={{ backgroundColor: agent.color }}
                >
                  {agent.logoLetter}
                </div>

                {/* Chi tiết CLI */}
                <div className="flex-1 min-w-[240px] flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-base text-cf-text font-semibold">
                      {agent.displayName}
                    </strong>
                    <Pill tone={pillTone}>{pillLabel}</Pill>
                  </div>

                  {/* Nội dung theo trạng thái */}
                  {agent.status === 'ready' && (
                    <div className="text-xs text-cf-muted">
                      {t('mh01.card.readyDesc', { count: agent.modelsCount })}
                    </div>
                  )}

                  {agent.status === 'not_logged_in' && (
                    <div className="flex flex-col gap-2">
                      <div className="text-xs text-cf-muted">{t('mh01.card.notLoggedInDesc')}</div>
                      <ol className="m-0 py-2.5 px-3 pl-7 bg-cf-bg rounded-cf border border-cf-border/60 text-xs text-cf-text flex flex-col gap-1 list-decimal">
                        <li>{t('mh01.card.notLoggedInStep1')}</li>
                        <li>{t('mh01.card.notLoggedInStep2')}</li>
                        <li>{t('mh01.card.notLoggedInStep3')}</li>
                      </ol>
                    </div>
                  )}

                  {agent.status === 'not_installed' && !isSkipped && (
                    <div className="flex flex-col gap-2">
                      <div className="text-xs text-cf-muted">{t('mh01.card.notInstalledDesc')}</div>
                      <ol className="m-0 py-2.5 px-3 pl-7 bg-cf-bg rounded-cf border border-cf-border/60 text-xs text-cf-text flex flex-col gap-1.5 list-decimal">
                        <li>
                          {t('mh01.card.notInstalledStep1')}{' '}
                          <button
                            type="button"
                            onClick={() => void handleOpenDocs(agent.agentId)}
                            className="text-cf-primary underline hover:opacity-80"
                          >
                            {t('mh01.card.openDocs')}
                          </button>
                        </li>
                        <li>
                          {t('mh01.card.notInstalledStep2')}
                          <div className="mt-1.5 flex items-center gap-2 p-2 bg-cf-dark text-cf-dark-text rounded-cf font-mono text-xs overflow-x-auto">
                            <span className="truncate flex-1 select-all">
                              {agent.installCommand}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                void handleCopyCommand(agent.agentId, agent.installCommand)
                              }
                              className="shrink-0 bg-[#26322E] text-white px-2 py-0.5 rounded text-[11px] font-sans hover:bg-[#34443E]"
                            >
                              {copiedAgentId === agent.agentId
                                ? t('mh01.card.copied')
                                : t('mh01.card.copyCommand')}
                            </button>
                          </div>
                        </li>
                        <li>{t('mh01.card.notInstalledStep3')}</li>
                      </ol>
                    </div>
                  )}

                  {agent.status === 'error' && (
                    <div className="text-xs text-cf-danger-ink">
                      {t('mh01.card.errorDesc', { error: agent.errorDetail ?? 'Unknown error' })}
                    </div>
                  )}
                </div>

                {/* Nút hành động của hàng */}
                <div className="shrink-0 self-center">
                  {agent.status === 'not_logged_in' && (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => void handleOpenLogin(agent.agentId)}
                    >
                      {t('mh01.card.openLogin')}
                    </Button>
                  )}

                  {agent.status === 'not_installed' && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleToggleSkip(agent.agentId)}
                    >
                      {isSkipped ? t('mh01.card.skipped') : t('mh01.card.skip')}
                    </Button>
                  )}

                  {agent.status === 'error' && (
                    <Button variant="default" size="sm" onClick={() => void checkAll()}>
                      {t('mh01.card.errorRetry')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Card công cụ hỗ trợ: Git */}
      <div className="bg-cf-surface border border-cf-line rounded-cf-card p-4 flex flex-col gap-2.5 shadow-cf-card">
        <div className="text-xs uppercase tracking-wider text-cf-muted font-bold font-mono">
          {t('mh01.git.eyebrow')}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <strong className="text-sm font-semibold">{t('mh01.git.label')}</strong>{' '}
            <span className="text-xs text-cf-muted">{t('mh01.git.role')}</span>
          </div>
          <Pill tone={gitStatus?.available ? 'ok' : 'warn'}>
            {gitStatus?.available ? t('mh01.git.ready') : t('mh01.git.missing')}
          </Pill>
        </div>
        <div className="text-xs text-cf-muted leading-relaxed">{t('mh01.git.desc')}</div>
      </div>

      {/* Notice bảo mật: Luật B3 */}
      <Notice tone="info" className="text-xs">
        <div>{t('mh01.notice')}</div>
      </Notice>

      {/* Chân trang điều hướng */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" disabled>
          {t('mh01.back')}
        </Button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-cf-muted hidden sm:inline">{t('mh01.moreLaterHint')}</span>
          <Button
            variant="primary"
            size="lg"
            disabled={!canContinue}
            onClick={() => void handleContinue()}
          >
            {continueLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
