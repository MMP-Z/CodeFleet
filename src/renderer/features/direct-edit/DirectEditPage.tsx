import { useEffect, useState } from 'react';
import type { EditableItemVM, ProjectRecord } from '@shared/ipc';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Pill } from '../../components/Pill';
import { t } from '../../i18n';
import { getBridge } from '../../lib/bridge';

export interface DirectEditPageProps {
  readonly project: ProjectRecord;
  readonly onBack: () => void;
}

type FilterType = 'all' | 'text' | 'color' | 'number';

export function DirectEditPage({ project, onBack }: DirectEditPageProps): React.JSX.Element {
  const bridge = getBridge();
  const [items, setItems] = useState<EditableItemVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void bridge.directEdit.getEditables(project.id).then((res) => {
      if (mounted) {
        if (res.ok) setItems(res.data);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [bridge, project.id]);

  const handleValueChange = (id: string, newVal: string): void => {
    setEditedValues((prev) => ({ ...prev, [id]: newVal }));
    setSuccessNotice(null);
  };

  const changedCount = Object.keys(editedValues).filter((id) => {
    const item = items.find((i) => i.id === id);
    return item && item.value !== editedValues[id];
  }).length;

  const handleDiscard = (): void => {
    setEditedValues({});
    setSuccessNotice(null);
  };

  const handleSave = async (): Promise<void> => {
    if (changedCount === 0 || saving) return;
    setSaving(true);
    try {
      for (const [id, val] of Object.entries(editedValues)) {
        const item = items.find((i) => i.id === id);
        if (item && item.value !== val) {
          await bridge.directEdit.saveDirect({
            projectId: project.id,
            filePath: item.file,
            locator: item.locator,
            newValue: val,
          });
        }
      }
      setSuccessNotice(t('mh06.saveSuccess'));
      setEditedValues({});
      // Nạp lại danh sách
      const reload = await bridge.directEdit.getEditables(project.id);
      if (reload.ok) setItems(reload.data);
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    return item.kind === filter;
  });

  return (
    <div className="flex flex-col h-full bg-cf-bg text-cf-text overflow-y-auto">
      {/* HEADER MH-06 */}
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
            <h2 className="text-title font-bold text-cf-text">{t('mh06.title')}</h2>
            <Pill tone="ok" className="py-0.5 text-[11px]">
              {t('mh06.tagline')}
            </Pill>
          </div>
        </div>

        <p className="text-small text-muted leading-relaxed max-w-2xl">{t('mh06.hint')}</p>

        {/* BỘ LỌC TẤT CẢ / CHỮ / MÀU / SỐ */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-small font-medium border transition-colors cursor-pointer ${
              filter === 'all'
                ? 'bg-primary-soft text-primary border-primary'
                : 'bg-surface text-cf-text border-border hover:bg-surface-2'
            }`}
            onClick={() => setFilter('all')}
          >
            {t('mh06.filterAll', { count: items.length.toString() })}
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-small font-medium border transition-colors cursor-pointer ${
              filter === 'text'
                ? 'bg-primary-soft text-primary border-primary'
                : 'bg-surface text-cf-text border-border hover:bg-surface-2'
            }`}
            onClick={() => setFilter('text')}
          >
            {t('mh06.filterText', {
              count: items.filter((i) => i.kind === 'text').length.toString(),
            })}
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-small font-medium border transition-colors cursor-pointer ${
              filter === 'color'
                ? 'bg-primary-soft text-primary border-primary'
                : 'bg-surface text-cf-text border-border hover:bg-surface-2'
            }`}
            onClick={() => setFilter('color')}
          >
            {t('mh06.filterColor', {
              count: items.filter((i) => i.kind === 'color').length.toString(),
            })}
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-md text-small font-medium border transition-colors cursor-pointer ${
              filter === 'number'
                ? 'bg-primary-soft text-primary border-primary'
                : 'bg-surface text-cf-text border-border hover:bg-surface-2'
            }`}
            onClick={() => setFilter('number')}
          >
            {t('mh06.filterNumber', {
              count: items.filter((i) => i.kind === 'number').length.toString(),
            })}
          </button>
        </div>
      </div>

      {/* DANH SÁCH CÁC Ô CHỈNH SỬA */}
      <div className="p-6 flex-1 flex flex-col gap-4 max-w-4xl">
        {successNotice && <Notice tone="info">{successNotice}</Notice>}

        {loading ? (
          <div className="p-8 text-center text-muted text-small">{t('mh06.scanning')}</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-muted text-small bg-surface border border-border rounded-card">
            {t('mh06.emptyFilter')}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredItems.map((item) => {
              const currentVal = editedValues[item.id] ?? item.value;
              const isModified = currentVal !== item.value;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-card border transition-all ${
                    isModified
                      ? 'bg-primary-soft/20 border-primary shadow-sm'
                      : 'bg-surface border-border hover:border-border-strong'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-cf-text text-small">{item.label}</span>
                      <Pill
                        tone={item.kind === 'color' ? 'brand' : 'wait'}
                        className="text-[10px] py-0"
                      >
                        {item.kind}
                      </Pill>
                    </div>
                    <span className="text-tiny font-mono text-muted">
                      {item.file} · {t('mh06.line', { line: (item.locator?.line ?? 1).toString() })}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {item.kind === 'color' ? (
                      <div className="flex items-center gap-2 w-full max-w-md">
                        <input
                          type="color"
                          value={
                            currentVal.startsWith('#') && currentVal.length === 7
                              ? currentVal
                              : '#10A37F'
                          }
                          onChange={(e) => handleValueChange(item.id, e.target.value)}
                          className="w-10 h-10 rounded border border-border cursor-pointer p-0.5"
                        />
                        <input
                          type="text"
                          value={currentVal}
                          onChange={(e) => handleValueChange(item.id, e.target.value)}
                          className="flex-1 px-3 py-2 rounded-md border border-border bg-surface text-small font-mono text-cf-text focus:outline-none focus:border-primary"
                        />
                      </div>
                    ) : item.kind === 'number' ? (
                      <input
                        type="number"
                        value={currentVal}
                        onChange={(e) => handleValueChange(item.id, e.target.value)}
                        className="w-48 px-3 py-2 rounded-md border border-border bg-surface text-small font-mono text-cf-text focus:outline-none focus:border-primary"
                      />
                    ) : (
                      <input
                        type="text"
                        value={currentVal}
                        onChange={(e) => handleValueChange(item.id, e.target.value)}
                        className="w-full px-3 py-2 rounded-md border border-border bg-surface text-small text-cf-text focus:outline-none focus:border-primary"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="p-4 bg-surface-2/40 border border-border rounded-card text-small text-muted flex items-center justify-between mt-4">
          <span>{t('mh06.wantMore')}</span>
          <button
            type="button"
            className="text-primary hover:underline font-medium cursor-pointer"
            onClick={onBack}
          >
            {t('mh06.backToChat')} →
          </button>
        </div>
      </div>

      {/* THANH THAO TÁC CỐ ĐỊNH PHÍA DƯỚI KHI CÓ THAY ĐỔI */}
      {changedCount > 0 && (
        <div className="sticky bottom-0 left-0 right-0 p-4 bg-surface border-t border-border shadow-lg flex items-center justify-between z-20">
          <span className="text-small font-medium text-cf-text">
            {t('mh06.changedCount', { count: changedCount.toString() })}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="default" size="md" disabled={saving} onClick={handleDiscard}>
              {t('mh06.discard')}
            </Button>
            <Button variant="primary" size="md" disabled={saving} onClick={() => void handleSave()}>
              {saving ? t('mh06.saving') : t('mh06.saveToFile')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
