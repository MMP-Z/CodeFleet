import React, { useState } from 'react';
import type { DetectResult, QuotaSnapshot } from '@shared/ipc';
import { formatQuotaChipSummary } from '../features/quota/quota-format';
import { QuotaChip } from './QuotaChip';
import { QuotaPopover } from './QuotaPopover';

export interface QuotaBarProps {
  readonly snapshots: readonly QuotaSnapshot[];
  readonly agents?: readonly DetectResult[];
  readonly onViewDetails: () => void;
  readonly className?: string;
}

/**
 * Thanh QuotaBar gắn trên AppHeader hiển thị các QuotaChip của từng AI (UI_SPEC 4.0, MH-03).
 */
export function QuotaBar({
  snapshots,
  agents = [],
  onViewDetails,
  className = '',
}: QuotaBarProps): React.JSX.Element {
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  // Tập hợp danh sách agentId cần hiển thị
  // Ưu tiên hiển thị các agent đã cài hoặc có snapshot
  const agentIdSet = new Set<string>();
  for (const a of agents) {
    if (a.installed && a.loggedIn) {
      agentIdSet.add(a.agentId);
    }
  }
  for (const s of snapshots) {
    agentIdSet.add(s.agentId);
  }

  const agentIds = Array.from(agentIdSet);

  if (agentIds.length === 0) {
    return <div className={`flex items-center gap-2 ${className}`} />;
  }

  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      {agentIds.map((agentId) => {
        const agentMeta = agents.find((a) => a.agentId === agentId);
        const label = agentMeta?.shortName ?? agentMeta?.displayName ?? agentId;
        const color = agentMeta?.color ?? '#10A37F';
        const summary = formatQuotaChipSummary(agentId, snapshots);
        const isPopoverOpen = activeAgentId === agentId;

        const agentSnapshots = snapshots.filter((s) => s.agentId === agentId);

        return (
          <div key={agentId} className="relative">
            <QuotaChip
              agentId={agentId}
              label={label}
              color={color}
              text={summary.text}
              tone={summary.tone}
              isActive={isPopoverOpen}
              onClick={() => {
                setActiveAgentId((prev) => (prev === agentId ? null : agentId));
              }}
            />

            {isPopoverOpen ? (
              <QuotaPopover
                agentId={agentId}
                agentLabel={agentMeta?.displayName ?? label}
                snapshots={agentSnapshots}
                onClose={() => setActiveAgentId(null)}
                onViewAll={onViewDetails}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
