import { useEffect, useId, useMemo, useState } from 'react';
import type { ProjectPathValidation, ProjectRecord } from '@shared/ipc';
import { Button } from '../../components/Button';
import { Notice } from '../../components/Notice';
import { Pill, type PillTone } from '../../components/Pill';
import { t } from '../../i18n';
import { getBridge } from '../../lib/bridge';

export interface ProjectSelectPageProps {
  readonly onProjectSelected: (project: ProjectRecord) => void;
  readonly isModal?: boolean;
  readonly onCloseModal?: () => void;
}

type ProjectMode = 'create' | 'open';
type TemplateKind = 'blank' | 'landing' | 'shop';

function formatLastOpened(lastOpened: string | null): string {
  if (!lastOpened) return '';
  const date = new Date(lastOpened);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 24 && now.getDate() === date.getDate()) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  if (diffHours < 48) {
    return 'Hôm qua';
  }
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

function getProjectColor(name: string): { bg: string; color: string } {
  const colors = [
    { bg: '#F3E3C8', color: '#7A4F00' },
    { bg: '#E3EFE9', color: '#1B6A47' },
    { bg: '#DDE9F8', color: '#184F8C' },
    { bg: '#F8DFD8', color: '#8A2F1B' },
    { bg: '#EFE3F8', color: '#682F8E' },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) % colors.length;
  }
  return colors[hash];
}

export function ProjectSelectPage({
  onProjectSelected,
  isModal = false,
  onCloseModal,
}: ProjectSelectPageProps): React.JSX.Element {
  const bridge = getBridge();
  const searchInputId = useId();
  const projectNameInputId = useId();
  const projectPathInputId = useId();

  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<ProjectMode>('create');
  const [projectName, setProjectName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKind>('blank');

  const [pathValidation, setPathValidation] = useState<ProjectPathValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [userDataDir, setUserDataDir] = useState<string>('');

  // Tải danh sách dự án và thông tin userDataDir
  useEffect(() => {
    let mounted = true;
    void Promise.all([bridge.projects.list(), bridge.system.getDataInfo()]).then(
      ([projRes, dataRes]) => {
        if (!mounted) return;
        if (projRes.ok) {
          setProjects(projRes.data);
        }
        if (dataRes.ok) {
          setUserDataDir(dataRes.data.userDataDir);
        }
        setLoading(false);
      },
    );
    return () => {
      mounted = false;
    };
  }, [bridge]);

  // Kiểm tra đường dẫn khi thay đổi
  useEffect(() => {
    if (!projectPath.trim()) {
      setPathValidation(null);
      setIsValidating(false);
      return;
    }

    setIsValidating(true);
    let active = true;
    const timer = setTimeout(() => {
      void bridge.projects.validatePath(projectPath.trim()).then((res) => {
        if (!active) return;
        setIsValidating(false);
        if (res.ok) {
          setPathValidation(res.data);
        }
      });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [projectPath, bridge]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q),
    );
  }, [projects, searchQuery]);

  const handlePickFolder = async (): Promise<void> => {
    const res = await bridge.projects.pickFolder();
    if (res.ok && res.data.folderPath) {
      const picked = res.data.folderPath;
      setProjectPath(picked);
      if (!projectName.trim()) {
        const parts = picked.replace(/\\/g, '/').split('/').filter(Boolean);
        const folderName = parts[parts.length - 1] ?? 'du-an-moi';
        setProjectName(folderName);
      }
    }
  };

  const handleSelectProject = async (project: ProjectRecord): Promise<void> => {
    const res = await bridge.projects.open(project.id);
    if (res.ok) {
      onProjectSelected(res.data);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!projectName.trim() || !projectPath.trim() || submitting) return;
    if (pathValidation && !pathValidation.isWritable) return;

    setSubmitting(true);
    try {
      if (mode === 'create') {
        const res = await bridge.projects.create({
          name: projectName.trim(),
          path: projectPath.trim(),
        });
        if (res.ok) {
          onProjectSelected(res.data);
        }
      } else {
        // Mở thư mục có sẵn
        const existing = projects.find(
          (p) =>
            p.path.toLowerCase().replace(/\\/g, '/') ===
            projectPath.trim().toLowerCase().replace(/\\/g, '/'),
        );
        if (existing) {
          const res = await bridge.projects.open(existing.id);
          if (res.ok) {
            onProjectSelected(res.data);
          }
        } else {
          const res = await bridge.projects.create({
            name: projectName.trim(),
            path: projectPath.trim(),
          });
          if (res.ok) {
            onProjectSelected(res.data);
          }
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFallbackToDocuments = (): void => {
    const base = userDataDir ? `${userDataDir}/Projects` : 'C:/Users/Documents/Projects';
    const slug = projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setProjectPath(`${base}/${slug || 'du-an-moi'}`);
  };

  const isFormValid =
    projectName.trim().length > 0 &&
    projectPath.trim().length > 0 &&
    (!pathValidation || pathValidation.isWritable);

  return (
    <div className={`p-6 max-w-6xl mx-auto w-full ${isModal ? '' : 'py-8'}`}>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-cf-text mb-1">{t('mh02.title')}</h1>
          <p className="text-muted text-small">{t('mh02.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            id={searchInputId}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('mh02.searchPlaceholder')}
            aria-label={t('mh02.searchAria')}
            className="px-3 py-1.5 border border-border rounded-md text-small bg-surface text-cf-text w-64 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {isModal && onCloseModal && (
            <Button variant="ghost" onClick={onCloseModal}>
              {t('common.close')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CỘT TRÁI: DỰ ÁN GẦN ĐÂY */}
        <section className="lg:col-span-5 bg-surface border border-border rounded-card overflow-hidden flex flex-col shadow-sm">
          <div className="px-4 py-3 border-b border-line text-eyebrow uppercase font-bold text-muted bg-surface-2/40">
            {t('mh02.recentProjects')}
          </div>

          <div className="divide-y divide-line max-h-[520px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-muted text-small">{t('common.loading')}</div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-6 text-center text-muted text-small">
                {searchQuery ? t('mh02.noMatch', { query: searchQuery }) : t('mh02.noRecent')}
              </div>
            ) : (
              filteredProjects.map((proj) => {
                const color = getProjectColor(proj.name);
                const firstLetter = (proj.name.trim()[0] ?? 'D').toUpperCase();
                const lastTime = formatLastOpened(proj.lastOpened);

                const tone: PillTone = 'ok';
                const label = t('mh02.status.done');

                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => void handleSelectProject(proj)}
                    className="w-full text-left p-3.5 hover:bg-surface-2 transition-colors flex items-center gap-3.5 group cursor-pointer"
                  >
                    <div
                      className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-base flex-none select-none"
                      style={{ backgroundColor: color.bg, color: color.color }}
                    >
                      {firstLetter}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <strong className="text-small font-semibold text-cf-text group-hover:text-primary transition-colors truncate">
                          {proj.name}
                        </strong>
                        <Pill tone={tone} className="text-[11px] py-0">
                          {label}
                        </Pill>
                      </div>
                      <div className="text-small font-mono text-muted truncate">{proj.path}</div>
                    </div>
                    {lastTime && (
                      <span className="text-small text-muted flex-none whitespace-nowrap">
                        {lastTime}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* CỘT PHẢI: BẮT ĐẦU DỰ ÁN (TẠO MỚI / MỞ SẴN) */}
        <section className="lg:col-span-7 bg-surface border border-border rounded-card p-6 shadow-sm flex flex-col gap-4">
          <h2 className="text-lg font-bold text-cf-text">{t('mh02.startSection')}</h2>

          {/* Chọn mode */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              aria-pressed={mode === 'create'}
              onClick={() => setMode('create')}
              className={`flex flex-col items-start gap-1 p-3.5 rounded-lg border text-left transition-all ${
                mode === 'create'
                  ? 'border-2 border-primary bg-primary-soft/30'
                  : 'border-border bg-surface hover:border-primary/50'
              }`}
            >
              <strong className="text-small text-cf-text">{t('mh02.modeCreate')}</strong>
              <span className="text-[12px] text-muted">{t('mh02.modeCreateDesc')}</span>
            </button>

            <button
              type="button"
              aria-pressed={mode === 'open'}
              onClick={() => setMode('open')}
              className={`flex flex-col items-start gap-1 p-3.5 rounded-lg border text-left transition-all ${
                mode === 'open'
                  ? 'border-2 border-primary bg-primary-soft/30'
                  : 'border-border bg-surface hover:border-primary/50'
              }`}
            >
              <strong className="text-small text-cf-text">{t('mh02.modeOpen')}</strong>
              <span className="text-[12px] text-muted">{t('mh02.modeOpenDesc')}</span>
            </button>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            {/* Tên dự án */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={projectNameInputId} className="text-small font-semibold text-cf-text">
                {t('mh02.projectName')}
              </label>
              <input
                id={projectNameInputId}
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={t('mh02.projectNamePlaceholder')}
                required
                className="px-3 py-2 border border-border rounded-md text-small bg-surface text-cf-text focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Lưu ở đâu / Thư mục */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={projectPathInputId} className="text-small font-semibold text-cf-text">
                {t('mh02.projectLocation')}
              </label>
              <div className="flex gap-2">
                <input
                  id={projectPathInputId}
                  type="text"
                  value={projectPath}
                  onChange={(e) => {
                    const newPath = e.target.value;
                    setProjectPath(newPath);
                    if (!projectName.trim() && newPath.trim()) {
                      const parts = newPath.replace(/\\/g, '/').split('/').filter(Boolean);
                      if (parts.length > 0) {
                        setProjectName(parts[parts.length - 1] ?? '');
                      }
                    }
                  }}
                  placeholder="D:/du-an/tiem-banh"
                  required
                  className="flex-1 px-3 py-2 font-mono border border-border rounded-md text-small bg-surface text-cf-text focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <Button type="button" variant="default" onClick={() => void handlePickFolder()}>
                  {t('mh02.chooseFolder')}
                </Button>
              </div>

              {/* Dòng trạng thái kiểm tra đường dẫn */}
              {isValidating ? (
                <span className="text-[12px] text-muted">{t('mh02.pathChecking')}</span>
              ) : pathValidation ? (
                pathValidation.isWritable ? (
                  <span className="text-[12px] text-ok-ink font-medium">
                    {pathValidation.hasUserGit
                      ? t('mh02.validHasGit')
                      : !pathValidation.isEmpty
                        ? t('mh02.validNotEmpty')
                        : t('mh02.validFolder')}
                  </span>
                ) : null
              ) : null}
            </div>

            {/* Thông báo lỗi quyền ghi (Luật U2 - bắt buộc 2 actions) */}
            {pathValidation && !pathValidation.isWritable && (
              <Notice
                tone="danger"
                small
                actions={[
                  {
                    label: t('mh02.permissionErrorActionDocs'),
                    onClick: handleFallbackToDocuments,
                  },
                  {
                    label: t('mh02.permissionErrorActionOther'),
                    onClick: () => void handlePickFolder(),
                  },
                ]}
              >
                <div>
                  <strong>{t('mh02.permissionErrorTitle', { path: projectPath })}</strong>
                </div>
              </Notice>
            )}

            {/* Bắt đầu từ mẫu (Chỉ khi tạo mới) */}
            {mode === 'create' && (
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center justify-between">
                  <span className="text-small font-semibold text-cf-text">
                    {t('mh02.templateLabel')}{' '}
                    <span className="text-muted font-normal">{t('mh02.templateOptional')}</span>
                  </span>
                  <span className="text-[12px] text-primary cursor-pointer hover:underline">
                    {t('mh02.templatePluginsLink')}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    aria-pressed={selectedTemplate === 'blank'}
                    onClick={() => setSelectedTemplate('blank')}
                    className={`flex flex-col gap-1 p-2.5 rounded-lg border text-left transition-all ${
                      selectedTemplate === 'blank'
                        ? 'border-2 border-primary bg-primary-soft/20'
                        : 'border-border bg-surface hover:border-primary/40'
                    }`}
                  >
                    <div
                      className="h-12 rounded bg-surface-2 border border-line"
                      style={{
                        backgroundImage:
                          'repeating-linear-gradient(45deg, var(--line), var(--line) 4px, transparent 4px, transparent 8px)',
                      }}
                    />
                    <strong className="text-small text-cf-text mt-1">
                      {t('mh02.templateBlank')}
                    </strong>
                  </button>

                  <button
                    type="button"
                    aria-pressed={selectedTemplate === 'landing'}
                    onClick={() => setSelectedTemplate('landing')}
                    className={`flex flex-col gap-1 p-2.5 rounded-lg border text-left transition-all ${
                      selectedTemplate === 'landing'
                        ? 'border-2 border-primary bg-primary-soft/20'
                        : 'border-border bg-surface hover:border-primary/40'
                    }`}
                  >
                    <div
                      className="h-12 rounded border border-line"
                      style={{ background: 'linear-gradient(180deg, #F3E3C8 40%, #FFF 40%)' }}
                    />
                    <strong className="text-small text-cf-text mt-1">
                      {t('mh02.templateLanding')}
                    </strong>
                    <Pill tone="brand" className="text-[10px] self-start py-0">
                      {t('mh02.templateCurated')}
                    </Pill>
                  </button>

                  <button
                    type="button"
                    aria-pressed={selectedTemplate === 'shop'}
                    onClick={() => setSelectedTemplate('shop')}
                    className={`flex flex-col gap-1 p-2.5 rounded-lg border text-left transition-all ${
                      selectedTemplate === 'shop'
                        ? 'border-2 border-primary bg-primary-soft/20'
                        : 'border-border bg-surface hover:border-primary/40'
                    }`}
                  >
                    <div
                      className="h-12 rounded border border-line"
                      style={{
                        background: 'linear-gradient(90deg, var(--primary-soft) 35%, #FFF 35%)',
                      }}
                    />
                    <strong className="text-small text-cf-text mt-1">
                      {t('mh02.templateShop')}
                    </strong>
                    <Pill tone="brand" className="text-[10px] self-start py-0">
                      {t('mh02.templateCurated')}
                    </Pill>
                  </button>
                </div>
              </div>
            )}

            {/* Nút hành động chính */}
            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={!isFormValid || submitting}
              >
                {submitting
                  ? t('common.loading')
                  : mode === 'create'
                    ? t('mh02.btnCreateAndChat')
                    : t('mh02.btnOpenAndChat')}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
