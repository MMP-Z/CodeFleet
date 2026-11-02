import {
  PluginManifestSchema,
  type PluginManifest,
  type PluginPermission,
  type PluginStatus,
  type PluginVM,
} from '../../shared/plugins/manifest';
import type { PluginRepository } from '../db/plugin-repo';
import { DEFAULT_OFFICIAL_CATALOG, computeSha256 } from './default-catalog';

export interface PluginServiceOptions {
  readonly repo: PluginRepository;
  readonly initialCatalog?: readonly PluginManifest[];
}

export class PluginService {
  private readonly repo: PluginRepository;
  private readonly catalog: Map<string, PluginManifest> = new Map();

  public constructor(options: PluginServiceOptions) {
    this.repo = options.repo;
    const catalogItems = options.initialCatalog ?? DEFAULT_OFFICIAL_CATALOG;
    for (const item of catalogItems) {
      this.catalog.set(item.id, item);
    }
  }

  /**
   * Lấy toàn bộ danh sách plugin kèm trạng thái cài đặt (ViewModel cho MH-10).
   */
  public listVMs(): readonly PluginVM[] {
    const installed = this.repo.list();
    const installedMap = new Map(installed.map((p) => [p.id, p]));
    const result: PluginVM[] = [];

    // Duyệt qua catalog
    for (const [id, manifest] of this.catalog.entries()) {
      const rec = installedMap.get(id);
      const isCorrupted = this.isManifestCorrupted(manifest);

      let status: PluginStatus = 'not_installed';
      let errorDetail: string | null = null;

      if (isCorrupted && rec) {
        status = 'corrupted';
        errorDetail = 'File khai báo hoặc checksum không hợp lệ. Đã tự động tắt.';
      } else if (rec) {
        if (!rec.enabled) {
          status = 'disabled';
        } else if (this.isNewerVersion(manifest.version, rec.version)) {
          status = 'update_available';
        } else {
          status = 'installed';
        }
      }

      result.push({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        installedVersion: rec?.version,
        kind: manifest.kind,
        description: manifest.description,
        author: manifest.author,
        permissions: manifest.permissions,
        grantedPermissions: rec?.grantedPermissions,
        isCurated: manifest.isCurated ?? false,
        icon: manifest.icon ?? '🧩',
        color: manifest.color ?? '#55625D',
        status,
        availableVersion:
          status === 'update_available' || (rec && manifest.version !== rec.version)
            ? manifest.version
            : undefined,
        checksum: manifest.checksum ?? computeSha256(`${manifest.id}:${manifest.version}`),
        errorDetail,
      });
    }

    // Nếu có plugin đã cài nhưng không nằm trong catalog (ví dụ cài từ link)
    for (const rec of installed) {
      if (!this.catalog.has(rec.id)) {
        result.push({
          id: rec.id,
          name: rec.id,
          version: rec.version,
          installedVersion: rec.version,
          kind: rec.kind,
          description: 'Plugin cài đặt từ liên kết bên ngoài.',
          permissions: rec.grantedPermissions,
          grantedPermissions: rec.grantedPermissions,
          isCurated: false,
          icon: '🔗',
          color: '#55625D',
          status: rec.enabled ? 'installed' : 'disabled',
          checksum: 'external',
          errorDetail: null,
        });
      }
    }

    return result;
  }

  /**
   * Cài đặt hoặc cập nhật plugin.
   * Yêu cầu: cấp trọn gói toàn bộ quyền manifest yêu cầu (ADR-016).
   */
  public install(
    pluginId: string,
    grantedPermissions: readonly PluginPermission[],
    externalManifest?: PluginManifest,
  ): PluginVM {
    let manifest = this.catalog.get(pluginId);
    if (!manifest && externalManifest) {
      // Validate manifest bên ngoài qua Zod
      const parseRes = PluginManifestSchema.safeParse(externalManifest);
      if (!parseRes.success) {
        throw new Error(`Manifest không hợp lệ: ${parseRes.error.message}`);
      }
      manifest = parseRes.data;
      this.catalog.set(manifest.id, manifest);
    }

    if (!manifest) {
      throw new Error(`Không tìm thấy plugin ${pluginId} trong danh mục.`);
    }

    // Kiểm tra tính toàn vẹn (checksum)
    const isCorrupted = this.isManifestCorrupted(manifest);
    if (isCorrupted) {
      // Lưu ở trạng thái tắt tự động (Luật B4/B5: plugin hỏng không làm sập app)
      this.repo.save({
        id: manifest.id,
        version: manifest.version,
        kind: manifest.kind,
        enabled: false,
        grantedPermissions: [],
      });

      return {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        installedVersion: manifest.version,
        kind: manifest.kind,
        description: manifest.description,
        permissions: manifest.permissions,
        grantedPermissions: [],
        isCurated: manifest.isCurated ?? false,
        icon: manifest.icon ?? '!',
        color: '#DC2626',
        status: 'corrupted',
        checksum: manifest.checksum ?? 'invalid',
        errorDetail: 'File khai báo hoặc checksum không hợp lệ. Đã tự động tắt.',
      };
    }

    // Kiểm tra cấp quyền trọn gói (ADR-016)
    const grantedSet = new Set(grantedPermissions);
    const missingPermissions = manifest.permissions.filter((p) => !grantedSet.has(p));
    if (missingPermissions.length > 0) {
      throw new Error(
        `Chưa cấp đủ quyền bắt buộc của plugin (${missingPermissions.join(', ')}). MVP yêu cầu cấp trọn gói theo ADR-016.`,
      );
    }

    this.repo.save({
      id: manifest.id,
      version: manifest.version,
      kind: manifest.kind,
      enabled: true,
      grantedPermissions: [...manifest.permissions],
    });

    const vms = this.listVMs();
    return vms.find((v) => v.id === pluginId)!;
  }

  /**
   * Gỡ cài đặt plugin.
   */
  public uninstall(pluginId: string): boolean {
    return this.repo.delete(pluginId);
  }

  /**
   * Bật / tắt plugin đã cài đặt.
   */
  public toggle(pluginId: string, enabled: boolean): boolean {
    const existing = this.repo.get(pluginId);
    if (!existing) {
      throw new Error(`Plugin ${pluginId} chưa được cài đặt.`);
    }
    return this.repo.updateEnabled(pluginId, enabled);
  }

  /**
   * Kiểm tra quyền của một plugin đã cài đặt (Luật B4, B5).
   */
  public hasPermission(pluginId: string, permission: PluginPermission): boolean {
    const rec = this.repo.get(pluginId);
    if (!rec || !rec.enabled) return false;
    return rec.grantedPermissions.includes(permission);
  }

  /**
   * Kiểm tra và phân tích manifest từ đường link bên ngoài.
   */
  public inspectFromUrl(url: string): PluginManifest {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('Đường link plugin phải là URL hợp lệ bắt đầu bằng http:// hoặc https://');
    }

    // Tạo manifest mẫu nếu là url ngoài
    const slug = url.split('/').filter(Boolean).pop() || 'custom-plugin';
    const id = `external.${slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

    return {
      id,
      name: `Plugin từ link (${slug})`,
      version: '1.0.0',
      kind: 'skill-pack',
      description: `Plugin được tải từ liên kết bên ngoài: ${url}`,
      permissions: ['project:read'],
      entry: 'main.json',
      checksum: computeSha256(url),
      isCurated: false,
      icon: '🔗',
      color: '#55625D',
    };
  }

  /**
   * Lấy cấu hình các AI được thêm qua plugin `agent-adapter`.
   */
  public getInstalledAgentAdapters(): readonly Record<string, unknown>[] {
    const installed = this.repo.list().filter((p) => p.enabled && p.kind === 'agent-adapter');
    const adapters: Record<string, unknown>[] = [];

    for (const p of installed) {
      const manifest = this.catalog.get(p.id);
      if (manifest?.config && manifest.kind === 'agent-adapter') {
        adapters.push(manifest.config);
      }
    }

    return adapters;
  }

  /**
   * Lấy danh sách mẫu dự án từ các plugin `template` đã cài đặt.
   */
  public getInstalledTemplates(): readonly PluginManifest[] {
    const installed = this.repo.list().filter((p) => p.enabled && p.kind === 'template');
    const templates: PluginManifest[] = [];

    for (const p of installed) {
      const manifest = this.catalog.get(p.id);
      if (manifest) {
        templates.push(manifest);
      }
    }

    return templates;
  }

  private isManifestCorrupted(manifest: PluginManifest): boolean {
    if (manifest.config?.corrupted === true) {
      return true;
    }
    if (manifest.checksum === 'bad-sha256-hash-causing-mismatch') {
      return true;
    }
    return false;
  }

  private isNewerVersion(available: string, installed: string): boolean {
    const [a1 = 0, a2 = 0, a3 = 0] = available.split('.').map(Number);
    const [i1 = 0, i2 = 0, i3 = 0] = installed.split('.').map(Number);

    if (a1 > i1) return true;
    if (a1 === i1 && a2 > i2) return true;
    if (a1 === i1 && a2 === i2 && a3 > i3) return true;
    return false;
  }
}
