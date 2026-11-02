import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

export interface PreviewStatus {
  readonly isWebProject: boolean;
  readonly isRunning: boolean;
  readonly url: string | null;
  readonly error: string | null;
}

export class PreviewServerService {
  private readonly runningServers = new Map<string, { server: http.Server; port: number }>();

  public isWebProject(projectDir: string): boolean {
    if (!fs.existsSync(projectDir)) return false;
    const hasIndexHtml = fs.existsSync(path.join(projectDir, 'index.html'));
    const hasPackageJson = fs.existsSync(path.join(projectDir, 'package.json'));
    return hasIndexHtml || hasPackageJson;
  }

  public getStatus(projectId: string, projectDir: string): PreviewStatus {
    const isWeb = this.isWebProject(projectDir);
    const running = this.runningServers.get(projectId);
    return {
      isWebProject: isWeb,
      isRunning: !!running,
      url: running ? `http://127.0.0.1:${running.port}` : null,
      error: null,
    };
  }

  public async start(
    projectId: string,
    projectDir: string,
  ): Promise<{ ok: boolean; url: string | null; error: string | null }> {
    if (!this.isWebProject(projectDir)) {
      return {
        ok: false,
        url: null,
        error: 'Không phải dự án web (không có index.html hoặc package.json)',
      };
    }

    const existing = this.runningServers.get(projectId);
    if (existing) {
      return { ok: true, url: `http://127.0.0.1:${existing.port}`, error: null };
    }

    return new Promise((resolve) => {
      const server = http.createServer((req, res) => {
        let reqPath = decodeURIComponent(req.url?.split('?')[0] ?? '/');
        if (reqPath === '/') reqPath = '/index.html';

        const safePath = path.normalize(path.join(projectDir, reqPath));
        if (!safePath.startsWith(path.resolve(projectDir))) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
          const ext = path.extname(safePath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'text/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
          };
          res.writeHead(200, {
            'Content-Type': mimeTypes[ext] ?? 'text/plain',
            'Access-Control-Allow-Origin': '*',
          });
          fs.createReadStream(safePath).pipe(res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not Found');
        }
      });

      // Lắng nghe trên cổng ngẫu nhiên 0
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          const port = addr.port;
          this.runningServers.set(projectId, { server, port });
          resolve({ ok: true, url: `http://127.0.0.1:${port}`, error: null });
        } else {
          resolve({ ok: false, url: null, error: 'Không thể mở cổng cho server xem trước' });
        }
      });

      server.on('error', (err) => {
        resolve({ ok: false, url: null, error: err.message });
      });
    });
  }

  public stop(projectId: string): void {
    const entry = this.runningServers.get(projectId);
    if (entry) {
      entry.server.close();
      this.runningServers.delete(projectId);
    }
  }

  public stopAll(): void {
    for (const [id] of this.runningServers) {
      this.stop(id);
    }
  }
}
