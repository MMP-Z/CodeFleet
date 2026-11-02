import { useEffect, useState } from 'react';
import type { DetectResult } from '@shared/agents';
import { t } from '../i18n';
import { getBridge } from '../lib/bridge';

export interface AiPickerProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
}

export function AiPicker({ value, onChange, disabled = false }: AiPickerProps): React.JSX.Element {
  const bridge = getBridge();
  const [agents, setAgents] = useState<DetectResult[]>([]);

  useEffect(() => {
    let mounted = true;
    void bridge.agents.detectAll().then((res) => {
      if (mounted && res.ok) {
        setAgents(res.data.filter((a) => a.installed && a.loggedIn));
      }
    });
    return () => {
      mounted = false;
    };
  }, [bridge]);

  return (
    <div className="flex items-center gap-2 text-small text-muted">
      <span>{t('mh03.composer.aiLabel')}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={t('mh03.composer.aiAria')}
        className="px-2.5 py-1 border border-border rounded-md text-[13px] bg-surface text-cf-text focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
      >
        <option value="auto">{t('mh03.composer.autoPick')}</option>
        {agents.map((agent) => (
          <option key={agent.agentId} value={agent.agentId}>
            {t('mh03.composer.pinAgent', { name: agent.displayName })}
          </option>
        ))}
      </select>
    </div>
  );
}
