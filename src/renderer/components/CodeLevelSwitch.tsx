import type { CodeLevel } from '@shared/settings';
import { Segmented } from './Segmented';
import { t } from '../i18n';

export interface CodeLevelSwitchProps {
  readonly level: CodeLevel;
  readonly onChange: (level: CodeLevel) => void;
  readonly className?: string;
}

export function CodeLevelSwitch({
  level,
  onChange,
  className = '',
}: CodeLevelSwitchProps): React.JSX.Element {
  return (
    <Segmented<CodeLevel>
      value={level}
      onChange={onChange}
      ariaLabel="Mức xem code"
      className={className}
      options={[
        { value: 'summary', label: t('mh03.code.levelSummary') },
        { value: 'diff', label: t('mh03.code.levelDiff') },
        { value: 'full', label: t('mh03.code.levelFull') },
      ]}
    />
  );
}
