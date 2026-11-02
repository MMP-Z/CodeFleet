import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Notice } from '../../components/Notice';
import { Pill } from '../../components/Pill';
import { Progress } from '../../components/Progress';
import { Segmented } from '../../components/Segmented';
import { useToast } from '../../components/Toast';
import { Toggle } from '../../components/Toggle';
import { t } from '../../i18n';

/**
 * Trang thử nội bộ /dev/components (ẩn sau featureFlags.devComponents — Luật P6 & Prompt 1).
 */
export function DevComponentsPage(): React.JSX.Element {
  const { pushToast } = useToast();
  const [toggleOn, setToggleOn] = useState(true);
  const [segVal, setSegVal] = useState<'summary' | 'diff' | 'full'>('summary');
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="w-full max-w-[1080px] mx-auto px-6 pt-7 pb-12 flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1>{t('dev.title')}</h1>
        <p className="text-muted text-small">{t('dev.subtitle')}</p>
      </div>

      {/* Buttons */}
      <section className="bg-surface border border-border rounded-card p-4 flex flex-col gap-3">
        <h2>{t('dev.sections.buttons')}</h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button>{t('dev.samples.btnDefault')}</Button>
          <Button variant="primary">{t('dev.samples.btnPrimary')}</Button>
          <Button variant="danger">{t('dev.samples.btnDanger')}</Button>
          <Button variant="ghost">{t('dev.samples.btnGhost')}</Button>
          <Button size="sm">{t('dev.samples.btnSmall')}</Button>
          <Button size="lg" variant="primary">
            {t('dev.samples.btnLarge')}
          </Button>
        </div>
      </section>

      {/* Pills */}
      <section className="bg-surface border border-border rounded-card p-4 flex flex-col gap-3">
        <h2>{t('dev.sections.pills')}</h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <Pill tone="ok">{t('dev.samples.pillOk')}</Pill>
          <Pill tone="run">{t('dev.samples.pillRun')}</Pill>
          <Pill tone="wait">{t('dev.samples.pillWait')}</Pill>
          <Pill tone="warn">{t('dev.samples.pillWarn')}</Pill>
          <Pill tone="danger">{t('dev.samples.pillDanger')}</Pill>
          <Pill tone="brand">{t('dev.samples.pillBrand')}</Pill>
        </div>
      </section>

      {/* Controls */}
      <section className="bg-surface border border-border rounded-card p-4 flex flex-col gap-4">
        <h2>{t('dev.sections.controls')}</h2>
        <div className="flex items-center gap-4 flex-wrap">
          <Toggle
            checked={toggleOn}
            onChange={setToggleOn}
            ariaLabel={t('dev.samples.toggleLabel')}
          />
          <Segmented
            ariaLabel={t('dev.samples.segAria')}
            value={segVal}
            onChange={setSegVal}
            options={[
              { value: 'summary', label: t('mh11.general.codeLevelSummary') },
              { value: 'diff', label: t('mh11.general.codeLevelDiff') },
              { value: 'full', label: t('mh11.general.codeLevelFull') },
            ]}
            className="w-[320px]"
          />
        </div>
        <div className="flex flex-col gap-2 max-w-[420px]">
          <span className="text-small text-muted">{t('dev.samples.progressOk')}</span>
          <Progress value={45} tone="ok" ariaLabel={t('dev.samples.progressOk')} />
          <span className="text-small text-muted">{t('dev.samples.progressLow')}</span>
          <Progress value={82} tone="low" ariaLabel={t('dev.samples.progressLow')} />
          <span className="text-small text-muted">{t('dev.samples.progressOut')}</span>
          <Progress value={100} tone="out" ariaLabel={t('dev.samples.progressOut')} />
        </div>
      </section>

      {/* Notices */}
      <section className="bg-surface border border-border rounded-card p-4 flex flex-col gap-3">
        <h2>{t('dev.sections.notices')}</h2>
        <Notice tone="info" small>
          {t('dev.samples.noticeInfo')}
        </Notice>
        <Notice tone="warn" small>
          {t('dev.samples.noticeWarn')}
        </Notice>
        <Notice
          tone="danger"
          small
          actions={[
            {
              label: t('common.retry'),
              onClick: () => undefined,
            },
          ]}
        >
          {t('dev.samples.noticeDanger')}
        </Notice>
        <Notice tone="neutral" small>
          {t('dev.samples.noticeNeutral')}
        </Notice>
      </section>

      {/* Dialog & Toasts */}
      <section className="bg-surface border border-border rounded-card p-4 flex flex-col gap-3">
        <h2>{t('dev.sections.overlays')}</h2>
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={() => setDialogOpen(true)}>{t('dev.samples.openDialog')}</Button>
          <Button
            onClick={() =>
              pushToast({
                tone: 'info',
                title: t('dev.samples.toastInfoTitle'),
                body: t('dev.samples.toastInfoBody'),
              })
            }
          >
            {t('dev.samples.triggerToastInfo')}
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              pushToast({
                tone: 'danger',
                title: t('dev.samples.toastDangerTitle'),
                body: t('dev.samples.toastDangerBody'),
                actions: [
                  {
                    label: t('common.retry'),
                    onClick: () => undefined,
                  },
                ],
              })
            }
          >
            {t('dev.samples.triggerToastDanger')}
          </Button>
        </div>

        <Dialog
          open={dialogOpen}
          title={t('dev.samples.dialogTitle')}
          tone="brand"
          iconSymbol="?"
          onClose={() => setDialogOpen(false)}
          footer={
            <>
              <Button onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" onClick={() => setDialogOpen(false)}>
                {t('dev.samples.dialogConfirm')}
              </Button>
            </>
          }
        >
          <p>{t('dev.samples.dialogBody')}</p>
        </Dialog>
      </section>
    </div>
  );
}
