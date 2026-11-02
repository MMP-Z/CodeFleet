import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseService } from '../db/database';
import { PluginRepository } from '../db/plugin-repo';
import { PluginService } from './plugin-service';

describe('Plugin System: Manifest, Repository, and Service (Phase 6, PLAN 6.7, MH-10)', () => {
  let tempDir: string;
  let dbService: DatabaseService;
  let repo: PluginRepository;
  let service: PluginService;

  beforeEach(() => {
    tempDir = path.join(
      process.cwd(),
      'scratch',
      `test-plugins-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    );
    fs.mkdirSync(tempDir, { recursive: true });

    dbService = new DatabaseService({
      userDataDir: tempDir,
    });
    dbService.openAndMigrate();

    repo = new PluginRepository(dbService.getDb());
    service = new PluginService({ repo });
  });

  afterEach(() => {
    dbService.close();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('PluginRepository saves, retrieves, updates enabled, and deletes cleanly', () => {
    const saved = repo.save({
      id: 'test.plugin-one',
      version: '1.0.0',
      kind: 'template',
      enabled: true,
      grantedPermissions: ['project:write'],
    });

    expect(saved.id).toBe('test.plugin-one');
    expect(saved.enabled).toBe(true);
    expect(saved.grantedPermissions).toEqual(['project:write']);

    const retrieved = repo.get('test.plugin-one');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.version).toBe('1.0.0');

    repo.updateEnabled('test.plugin-one', false);
    expect(repo.get('test.plugin-one')?.enabled).toBe(false);

    const deleted = repo.delete('test.plugin-one');
    expect(deleted).toBe(true);
    expect(repo.get('test.plugin-one')).toBeNull();
  });

  it('PluginService.listVMs returns catalog with 4 kinds of plugins', () => {
    const vms = service.listVMs();
    expect(vms.length).toBeGreaterThanOrEqual(5);

    const kinds = new Set(vms.map((v) => v.kind));
    expect(kinds.has('template')).toBe(true);
    expect(kinds.has('skill-pack')).toBe(true);
    expect(kinds.has('agent-adapter')).toBe(true);
    expect(kinds.has('mcp-server')).toBe(true);

    const curatedCount = vms.filter((v) => v.isCurated).length;
    expect(curatedCount).toBeGreaterThanOrEqual(4);

    // Initial state: not installed
    const landing = vms.find((v) => v.id === 'example.template-landing');
    expect(landing?.status).toBe('not_installed');
  });

  it('PluginService.install enforces all-or-nothing permissions (ADR-016)', () => {
    // example.mcp-database requires ['project:read', 'process:run', 'mcp:connect']
    expect(() => {
      service.install('example.mcp-database', ['project:read']);
    }).toThrow(/Chưa cấp đủ quyền bắt buộc/);

    const installed = service.install('example.mcp-database', [
      'project:read',
      'process:run',
      'mcp:connect',
    ]);
    expect(installed.status).toBe('installed');
    expect(service.hasPermission('example.mcp-database', 'mcp:connect')).toBe(true);
    expect(service.hasPermission('example.mcp-database', 'project:write')).toBe(false);
  });

  it('PluginService auto-disables corrupted plugins without crashing the app', () => {
    // example.template-corrupt has bad checksum / corrupted flag
    const result = service.install('example.template-corrupt', ['project:write']);
    expect(result.status).toBe('corrupted');
    expect(result.errorDetail).toContain('tự động tắt');

    // App continues running, listVMs reports it as corrupted
    const vms = service.listVMs();
    const corruptVm = vms.find((v) => v.id === 'example.template-corrupt');
    expect(corruptVm?.status).toBe('corrupted');
    expect(service.hasPermission('example.template-corrupt', 'project:write')).toBe(false);
  });

  it('PluginService detects updates when catalog version is newer than installed version', () => {
    // Simulate older version installed in repo
    repo.save({
      id: 'example.skill-ecommerce-safety',
      version: '2.1.0',
      kind: 'skill-pack',
      enabled: true,
      grantedPermissions: ['project:read'],
    });

    // Catalog version is 2.2.0
    const vms = service.listVMs();
    const skillVm = vms.find((v) => v.id === 'example.skill-ecommerce-safety');
    expect(skillVm?.status).toBe('update_available');
    expect(skillVm?.installedVersion).toBe('2.1.0');
    expect(skillVm?.availableVersion).toBe('2.2.0');
  });

  it('PluginService installs external plugins from link and toggles them', () => {
    const inspected = service.inspectFromUrl('https://github.com/community/awesome-skill');
    expect(inspected.id).toContain('external.');
    expect(inspected.isCurated).toBe(false);

    const installed = service.install(inspected.id, inspected.permissions, inspected);
    expect(installed.status).toBe('installed');

    service.toggle(inspected.id, false);
    const disabledVm = service.listVMs().find((v) => v.id === inspected.id);
    expect(disabledVm?.status).toBe('disabled');

    service.uninstall(inspected.id);
    const uninstalledVm = service.listVMs().find((v) => v.id === inspected.id);
    expect(uninstalledVm?.status).toBe('not_installed');
  });

  it('PluginService provides installed agent adapters and templates', () => {
    service.install('example.agent-qwen', ['process:run']);
    service.install('example.template-landing', ['project:write']);

    const adapters = service.getInstalledAgentAdapters();
    expect(adapters.length).toBe(1);
    expect(adapters[0].agentId).toBe('qwen');

    const templates = service.getInstalledTemplates();
    expect(templates.length).toBe(1);
    expect(templates[0].id).toBe('example.template-landing');
  });
});
