import type { ProjectRecord } from '@shared/ipc';
import { Dialog } from '../../components/Dialog';
import { t } from '../../i18n';
import { ProjectSelectPage } from './ProjectSelectPage';

export interface ProjectSelectModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onProjectSelected: (project: ProjectRecord) => void;
}

export function ProjectSelectModal({
  open,
  onClose,
  onProjectSelected,
}: ProjectSelectModalProps): React.JSX.Element | null {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      title={t('mh02.dialogSwitchTitle')}
      wide
      onClose={onClose}
      onEscape={onClose}
    >
      <div className="py-2">
        <ProjectSelectPage
          isModal
          onCloseModal={onClose}
          onProjectSelected={(proj) => {
            onProjectSelected(proj);
            onClose();
          }}
        />
      </div>
    </Dialog>
  );
}
