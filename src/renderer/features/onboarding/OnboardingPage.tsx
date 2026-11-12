import React, { useCallback, useEffect, useState } from 'react';
import type { DetectResult } from '@shared/agents';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Pill } from '../../components/Pill';
import { t } from '../../i18n';
import { getBridge } from '../../lib/bridge';

export interface OnboardingPageProps {
  readonly onCompleted?: () => void;
  readonly initialStep?: 1 | 2 | 3;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onCompleted, initialStep = 1 }) => {
  const bridge = getBridge();

  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
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

  const handleFinish = async () => {
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
      {/* Stepper 3 bước (Chào mừng -> Kiểm tra AI -> Chọn dự án) */}
      <div className="flex items-center gap-2 flex-wrap" aria-label={t('mh01.stepperAria')}>
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`flex items-center gap-2 text-xs font-semibold cursor-pointer ${
            step === 1 ? 'text-cf-primary' : 'text-cf-muted hover:text-cf-text'
          }`}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
              step > 1
                ? 'bg-cf-ok-bg text-cf-ok-ink'
                : step === 1
                  ? 'bg-cf-primary text-white'
                  : 'bg-cf-line text-cf-muted'
            }`}
          >
            {step > 1 ? '✓' : '1'}
          </span>
          <span>{t('mh01.step1')}</span>
        </button>

        <span className="w-7 h-[1px] bg-cf-border self-center" />

        <button
          type="button"
          onClick={() => setStep(2)}
          className={`flex items-center gap-2 text-xs font-semibold cursor-pointer ${
            step === 2 ? 'text-cf-primary' : 'text-cf-muted hover:text-cf-text'
          }`}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
              step > 2
                ? 'bg-cf-ok-bg text-cf-ok-ink'
                : step === 2
                  ? 'bg-cf-primary text-white'
                  : 'bg-cf-line text-cf-muted'
            }`}
          >
            {step > 2 ? '✓' : '2'}
          </span>
          <span>{t('mh01.step2')}</span>
        </button>

        <span className="w-7 h-[1px] bg-cf-border self-center" />

        <button
          type="button"
          onClick={() => {
            if (canContinue) setStep(3);
          }}
          disabled={!canContinue}
          className={`flex items-center gap-2 text-xs font-semibold ${
            canContinue ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
          } ${step === 3 ? 'text-cf-primary' : 'text-cf-muted hover:text-cf-text'}`}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${
              step === 3 ? 'bg-cf-primary text-white' : 'bg-cf-line text-cf-muted'
            }`}
          >
            3
          </span>
          <span>{t('mh01.step3')}</span>
        </button>
      </div>

      {/* ================= BƯỚC 1: CHÀO MỪNG ================= */}
      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-cf-text">
              {t('mh01.welcomeTitle')}
            </h1>
            <p className="text-sm text-cf-muted leading-relaxed">{t('mh01.welcomeSubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-cf-surface border border-cf-line rounded-cf-card p-4 flex flex-col gap-2">
              <div className="text-2xl">🖥️</div>
              <h2 className="text-sm font-bold text-cf-text">{t('mh01.welcomePillar1Title')}</h2>
              <p className="text-xs text-cf-muted leading-relaxed">
                {t('mh01.welcomePillar1Desc')}
              </p>
            </div>

            <div className="bg-cf-surface border border-cf-line rounded-cf-card p-4 flex flex-col gap-2">
              <div className="text-2xl">📁</div>
              <h2 className="text-sm font-bold text-cf-text">{t('mh01.welcomePillar2Title')}</h2>
              <p className="text-xs text-cf-muted leading-relaxed">
                {t('mh01.welcomePillar2Desc')}
              </p>
            </div>

            <div className="bg-cf-surface border border-cf-line rounded-cf-card p-4 flex flex-col gap-2">
              <div className="text-2xl">🛡️</div>
              <h2 className="text-sm font-bold text-cf-text">{t('mh01.welcomePillar3Title')}</h2>
              <p className="text-xs text-cf-muted leading-relaxed">
                {t('mh01.welcomePillar3Desc')}
              </p>
            </div>
          </div>

          <Notice tone="neutral">{t('mh01.notice')}</Notice>

          <div className="flex justify-end pt-2">
            <Button variant="primary" size="lg" onClick={() => setStep(2)}>
              {t('mh01.startSetup')}
            </Button>
          </div>
        </div>
      )}

      {/* ================= BƯỚC 2: KIỂM TRA AI ================= */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          {/* Tiêu đề & mô tả */}
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-cf-text">{t('mh01.title')}</h1>
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
              <Button
                variant="default"
                size="sm"
                onClick={() => void checkAll()}
                disabled={detecting}
              >
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
                        <p className="text-xs text-cf-muted">
                          {t('mh01.card.readyDesc', { count: agent.modelsCount })}
                        </p>
                      )}

                      {agent.status === 'not_logged_in' && (
                        <div className="flex flex-col gap-2 mt-1">
                          <p className="text-xs text-cf-muted">{t('mh01.card.notLoggedInDesc')}</p>
                          <ol className="list-decimal list-inside text-xs text-cf-muted space-y-1">
                            <li>{t('mh01.card.notLoggedInStep1')}</li>
                            <li>{t('mh01.card.notLoggedInStep2')}</li>
                            <li>{t('mh01.card.notLoggedInStep3')}</li>
                          </ol>
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => void handleOpenLogin(agent.agentId)}
                            >
                              {t('mh01.card.openLogin')}
                            </Button>
                          </div>
                        </div>
                      )}

                      {agent.status === 'not_installed' && (
                        <div className="flex flex-col gap-2 mt-1">
                          <p className="text-xs text-cf-muted">{t('mh01.card.notInstalledDesc')}</p>
                          <ol className="list-decimal list-inside text-xs text-cf-muted space-y-1.5">
                            <li>
                              {t('mh01.card.notInstalledStep1')}{' '}
                              <button
                                type="button"
                                className="text-cf-primary font-medium hover:underline inline"
                                onClick={() => void handleOpenDocs(agent.agentId)}
                              >
                                {t('mh01.card.openDocs')}
                              </button>
                            </li>
                            {agent.installCommand && (
                              <li className="space-y-1">
                                <span>{t('mh01.card.notInstalledStep2')}</span>
                                <div className="flex items-center gap-2 mt-1 max-w-full">
                                  <code className="bg-cf-canvas border border-cf-border px-2.5 py-1 rounded text-xs font-mono text-cf-text break-all select-all flex-1">
                                    {agent.installCommand}
                                  </code>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() =>
                                      void handleCopyCommand(agent.agentId, agent.installCommand!)
                                    }
                                  >
                                    {copiedAgentId === agent.agentId
                                      ? t('mh01.card.copied')
                                      : t('mh01.card.copyCommand')}
                                  </Button>
                                </div>
                              </li>
                            )}
                            <li>{t('mh01.card.notInstalledStep3')}</li>
                          </ol>
                          <div className="pt-1">
                            <button
                              type="button"
                              className="text-xs text-cf-muted hover:text-cf-text underline"
                              onClick={() => handleToggleSkip(agent.agentId)}
                            >
                              {isSkipped ? t('mh01.card.skipped') : t('mh01.card.skip')}
                            </button>
                          </div>
                        </div>
                      )}

                      {agent.status === 'error' && (
                        <div className="flex flex-col gap-2 mt-1">
                          <p className="text-xs text-cf-danger-ink">
                            {t('mh01.card.errorDesc', {
                              error: agent.errorDetail ?? '',
                            })}
                          </p>
                          <div className="pt-1">
                            <Button variant="default" size="sm" onClick={() => void checkAll()}>
                              {t('mh01.card.errorRetry')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Công cụ hỗ trợ: Git */}
          <div className="bg-cf-surface border border-cf-line rounded-cf-card p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-cf-muted font-bold font-mono">
                  {t('mh01.git.eyebrow')}
                </span>
                <span className="font-mono font-bold text-sm text-cf-text">
                  {t('mh01.git.label')}
                </span>
                <span className="text-xs text-cf-muted">{t('mh01.git.role')}</span>
              </div>
              <Pill tone={gitStatus?.available ? 'ok' : 'wait'}>
                {gitStatus?.available
                  ? `${t('mh01.git.ready')} (${gitStatus.version ?? ''})`
                  : t('mh01.git.missing')}
              </Pill>
            </div>
            <p className="text-xs text-cf-muted leading-relaxed">{t('mh01.git.desc')}</p>
          </div>

          {/* Lưu ý an toàn */}
          <Notice tone="neutral">{t('mh01.notice')}</Notice>

          {/* Nút hành động Bước 2 */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="default" onClick={() => setStep(1)}>
              {t('mh01.backToWelcome')}
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-cf-muted">{t('mh01.moreLaterHint')}</span>
              <Button
                variant="primary"
                size="lg"
                disabled={!canContinue}
                onClick={() => setStep(3)}
              >
                {continueLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================= BƯỚC 3: SẴN SÀNG ================= */}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-cf-text">
              {t('mh01.readyStepTitle')}
            </h1>
            <p className="text-sm text-cf-muted leading-relaxed">{t('mh01.readyStepSubtitle')}</p>
          </div>

          <div className="bg-cf-surface border border-cf-line rounded-cf-card p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🚀</span>
              <div className="flex flex-col">
                <strong className="text-base text-cf-text font-semibold">
                  {t('mh01.summaryCount', {
                    installed: installedCount,
                    total: totalCount,
                    ready: readyAgents.length,
                  })}
                </strong>
                <p className="text-xs text-cf-muted mt-1 leading-relaxed">
                  {t('mh01.readySummary', {
                    ready: readyAgents.length,
                    names: readyAgents.map((a) => a.displayName).join(', '),
                  })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {readyAgents.map((agent) => (
                <div
                  key={agent.agentId}
                  className="bg-cf-canvas border border-cf-line rounded-cf-input p-3 flex items-center gap-3"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs"
                    style={{ backgroundColor: agent.color }}
                  >
                    {agent.logoLetter}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-cf-text truncate">
                      {agent.displayName}
                    </span>
                    <span className="text-xs text-cf-muted">
                      {t('mh01.card.readyDesc', { count: agent.modelsCount })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Notice tone="neutral">{t('mh01.notice')}</Notice>

          <div className="flex items-center justify-between pt-2">
            <Button variant="default" onClick={() => setStep(2)}>
              {t('mh01.backToAiCheck')}
            </Button>
            <Button variant="primary" size="lg" onClick={() => void handleFinish()}>
              {t('mh01.finishOnboarding')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
