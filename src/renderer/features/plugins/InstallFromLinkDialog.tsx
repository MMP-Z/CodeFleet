import React, { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Notice } from '../../components/Notice';
import { t } from '../../i18n';

export interface InstallFromLinkDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (url: string) => void;
}

export function InstallFromLinkDialog({
  open,
  onClose,
  onSubmit,
}: InstallFromLinkDialogProps): React.JSX.Element | null {
  const [url, setUrl] = useState('');
  const [understood, setUnderstood] = useState(false);

  if (!open) return null;

  const isValidUrl = url.trim().startsWith('http://') || url.trim().startsWith('https://');
  const canSubmit = understood && isValidUrl;

  const handleSubmit = (): void => {
    if (canSubmit) {
      onSubmit(url.trim());
      setUrl('');
      setUnderstood(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('mh10.dialogLink.title')}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="ghost" onClick={onClose}>
            {t('mh10.dialogLink.cancel')}
          </Button>
          <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit}>
            {t('mh10.dialogLink.submit')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 text-cf-text text-small">
        <p className="text-muted leading-relaxed -mt-2">{t('mh10.dialogLink.subtitle')}</p>

        {/* URL Input */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="plugin-url-input" className="font-semibold text-[13px]">
            {t('mh10.dialogLink.urlLabel')}
          </label>
          <input
            id="plugin-url-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/..."
            className="w-full px-3 py-2 border border-border rounded-btn font-mono text-[13px] bg-surface text-cf-text focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
          />
        </div>

        {/* Notice tone danger (Luật U2: kèm hành động rõ ràng) */}
        <Notice
          tone="danger"
          actions={[{ label: t('mh10.dialogLink.cancel'), onClick: onClose }]}
        >
          {t('mh10.dialogLink.dangerNotice')}
        </Notice>

        {/* Understand risk checkbox */}
        <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            className="w-4 h-4 rounded text-primary focus:ring-primary/40 border-border"
          />
          <span className="text-[13px] font-medium">{t('mh10.dialogLink.understandRisk')}</span>
        </label>
      </div>
    </Dialog>
  );
}
