import { useEffect, useState } from 'react';
import type {
  DecisionItemVM,
  ProjectMapItemVM,
  ProjectRecord,
  StepVM,
  UserEditItemVM,
} from '@shared/ipc';
import { Pill } from '../../components/Pill';
import { Segmented } from '../../components/Segmented';
import { t } from '../../i18n';
import { getBridge } from '../../lib/bridge';

export interface ProjectHistoryPageProps {
  readonly project: ProjectRecord;
  readonly onBack: () => void;
  readonly onViewCode?: (stepId: string) => void;
}

type HistoryTab = 'history' | 'decisions' | 'map';

export function ProjectHistoryPage({
  project,
  onBack,
  onViewCode,
}: ProjectHistoryPageProps): React.JSX.Element {
  const bridge = getBridge();
  const [tab, setTab] = useState<HistoryTab>('history');
  const [steps, setSteps] = useState<StepVM[]>([]);
  const [userEdits, setUserEdits] = useState<UserEditItemVM[]>([]);
  const [decisions, setDecisions] = useState<DecisionItemVM[]>([]);
  const [mapItems, setMapItems] = useState<ProjectMapItemVM[]>([]);
  const [loading, setLoading] = useState(true);

  // Bộ lọc cho Tab 2 Decisions
  const [decisionSearch, setDecisionSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<'all' | 'approach' | 'pick' | 'switch'>(
    'all',
  );

  useEffect(() => {
    let mounted = true;
    async function loadData(): Promise<void> {
      setLoading(true);
      try {
        const [histRes, mapRes] = await Promise.all([
          bridge.history.get(project.id),
          bridge.projectMap.get(project.id),
        ]);
        if (!mounted) return;
        if (histRes.ok) {
          setSteps(histRes.data.steps);
          setUserEdits(histRes.data.userEdits);
          setDecisions(histRes.data.decisions);
        }
        if (mapRes.ok) {
          setMapItems(mapRes.data);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadData();
    return () => {
      mounted = false;
    };
  }, [bridge, project.id]);

  const filteredDecisions = decisions.filter((d) => {
    if (decisionFilter !== 'all' && d.kind !== decisionFilter) return false;
    if (decisionSearch.trim() && !d.text.toLowerCase().includes(decisionSearch.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-cf-bg text-cf-text overflow-y-auto">
      {/* HEADER MH-09 */}
      <div className="p-6 bg-surface border-b border-border flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-small font-medium text-muted hover:text-cf-text cursor-pointer transition-colors"
              onClick={onBack}
            >
              {t('mh06.backToChat')}
            </button>
            <span className="text-muted">/</span>
            <h2 className="text-title font-bold text-cf-text">{t('mh09.title')}</h2>
            <span className="text-small text-muted font-mono">{project.name}</span>
          </div>

          <Segmented<HistoryTab>
            value={tab}
            onChange={setTab}
            ariaLabel={t('mh09.navAria')}
            options={[
              { value: 'history', label: t('mh09.tabs.history') },
              { value: 'decisions', label: t('mh09.tabs.decisions') },
              { value: 'map', label: t('mh09.tabs.map') },
            ]}
          />
        </div>
      </div>

      {/* NỘI DUNG TỪNG TAB */}
      <div className="p-6 flex-1 flex flex-col max-w-4xl">
        {loading ? (
          <div className="p-8 text-center text-muted text-small">{t('mh09.loading')}</div>
        ) : tab === 'history' ? (
          /* TAB 1: LỊCH SỬ & HOÀN TÁC */
          <div className="flex flex-col gap-4">
            <h3 className="text-body font-bold text-cf-text">{t('mh09.history.title')}</h3>
            <div className="flex flex-col gap-3 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border">
              {steps.map((step) => {
                const isUndone = step.status === 'undone';
                return (
                  <div
                    key={step.id}
                    className={`ml-8 p-4 rounded-card border bg-surface flex items-start justify-between gap-4 transition-all ${
                      isUndone ? 'opacity-50 line-through border-line' : 'border-border shadow-sm'
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-small text-cf-text">
                          {t('mh03.stepNumber', { seq: step.seq.toString() })}
                        </span>
                        <Pill tone={isUndone ? 'wait' : 'ok'} className="text-[10px] py-0">
                          {isUndone
                            ? t('mh09.history.undoneNotice')
                            : t(`mh03.status.${step.status}`)}
                        </Pill>
                        <span className="text-tiny text-muted">
                          {step.agentLabel} {step.modelLabel ? `· ${step.modelLabel}` : ''}
                        </span>
                      </div>
                      <p className="text-small text-cf-text">{step.title}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-none">
                      {onViewCode && (
                        <button
                          type="button"
                          className="px-2.5 py-1 text-tiny font-medium rounded border border-border bg-surface text-cf-text hover:bg-surface-2 transition-colors cursor-pointer"
                          onClick={() => onViewCode(step.id)}
                        >
                          {t('mh09.history.viewCode')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* CÁC LẦN NGƯỜI DÙNG TỰ SỬA */}
              {userEdits.map((edit) => (
                <div
                  key={edit.id}
                  className="ml-8 p-3 rounded-card border border-warn-border bg-warn-bg/20 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 text-small">
                    <Pill tone="warn" className="text-[10px] py-0">
                      {t('mh09.history.userEditPill')}
                    </Pill>
                    <span className="font-mono text-cf-text font-medium">{edit.path}</span>
                    <span className="text-tiny text-muted">
                      {new Date(edit.editedAt).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                </div>
              ))}

              {/* BẮT ĐẦU DỰ ÁN */}
              <div className="ml-8 p-3 rounded-lg border border-dashed border-border text-center text-tiny text-muted font-medium">
                {t('mh09.history.startProject')} ·{' '}
                {new Date(project.createdAt).toLocaleDateString('vi-VN')}
              </div>
            </div>
          </div>
        ) : tab === 'decisions' ? (
          /* TAB 2: VÌ SAO LÀM VẬY (BẢNG QUYẾT ĐỊNH) */
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-body font-bold text-cf-text">{t('mh09.decisions.title')}</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={t('mh09.decisions.searchPlaceholder')}
                  value={decisionSearch}
                  onChange={(e) => setDecisionSearch(e.target.value)}
                  className="px-3 py-1.5 rounded-md border border-border bg-surface text-small text-cf-text w-56 focus:outline-none focus:border-primary"
                />
                <select
                  value={decisionFilter}
                  onChange={(e) =>
                    setDecisionFilter(e.target.value as 'all' | 'approach' | 'pick' | 'switch')
                  }
                  className="px-3 py-1.5 rounded-md border border-border bg-surface text-small text-cf-text focus:outline-none focus:border-primary"
                >
                  <option value="all">{t('mh09.decisions.filterAll')}</option>
                  <option value="approach">{t('mh09.decisions.filterApproach')}</option>
                  <option value="pick">{t('mh09.decisions.filterPick')}</option>
                  <option value="switch">{t('mh09.decisions.filterSwitch')}</option>
                </select>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-card overflow-hidden shadow-sm">
              <table className="w-full text-left text-small border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-2/60 text-muted font-medium text-eyebrow uppercase">
                    <th className="p-3 w-28">{t('mh09.decisions.colTime')}</th>
                    <th className="p-3 w-28">{t('mh09.decisions.colKind')}</th>
                    <th className="p-3">{t('mh09.decisions.colDecision')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredDecisions.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-muted">
                        Không có quyết định nào khớp với tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    filteredDecisions.map((d) => (
                      <tr key={d.id} className="hover:bg-surface-2/30 transition-colors">
                        <td className="p-3 font-mono text-tiny text-muted">
                          {new Date(d.createdAt).toLocaleTimeString('vi-VN')}
                        </td>
                        <td className="p-3">
                          <Pill
                            tone={
                              d.kind === 'switch' ? 'warn' : d.kind === 'pick' ? 'brand' : 'wait'
                            }
                            className="text-[10px] py-0"
                          >
                            {d.kind === 'switch'
                              ? t('mh09.decisions.filterSwitch')
                              : d.kind === 'pick'
                                ? t('mh09.decisions.filterPick')
                                : t('mh09.decisions.filterApproach')}
                          </Pill>
                        </td>
                        <td className="p-3 text-cf-text leading-relaxed">{d.text}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* TAB 3: BẢN ĐỒ DỰ ÁN */
          <div className="flex flex-col gap-4">
            <h3 className="text-body font-bold text-cf-text">{t('mh09.map.title')}</h3>
            {mapItems.length === 0 ? (
              <div className="p-8 text-center text-muted text-small bg-surface border border-border rounded-card">
                {t('mh09.map.empty')}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {mapItems.map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-card border bg-surface flex flex-col gap-2.5 shadow-sm ${
                      item.isSensitive ? 'border-warn-border' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-body text-cf-text">{item.feature}</span>
                      {item.isSensitive && (
                        <Pill tone="warn" className="text-[10px] py-0">
                          {t('mh09.map.sensitive')}
                        </Pill>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-small text-muted leading-relaxed">{item.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.files.map((f, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-surface-2 font-mono text-tiny text-cf-text border border-line"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
