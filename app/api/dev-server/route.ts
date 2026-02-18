import { NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { appendFile, access, stat } from 'fs/promises';
import { openSync } from 'fs';
import path from 'path';
import { readJsonFile, flattenProjectsWithChildren, loadAllProjects } from '@/lib/data';
import type { Project } from '@/lib/types';

const execAsyncRaw = promisify(exec);

/** execAsync with a default 8-second timeout to prevent lsof/ps from hanging the API */
function execAsync(cmd: string, opts?: { timeout?: number }) {
  return execAsyncRaw(cmd, { timeout: opts?.timeout ?? 8000 });
}

const DASHBOARD_PORT = 3002;

// In-memory cache to prevent concurrent polling from saturating the event loop
let cachedGetResponse: { data: unknown; timestamp: number } | null = null;
const GET_CACHE_TTL = 5000; // 5 seconds
const LOG_PATH = path.join(process.cwd(), '.dev-server.log');

async function logEvent(message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(`[dev-server] ${message}`);
  try {
    await appendFile(LOG_PATH, line);
  } catch {
    // logging should never crash the server
  }
}

// 驗證 devCommand 是否安全（防止命令注入）
function isCommandSafe(command: string): boolean {
  // 禁止可執行額外命令的 shell 操作符
  const dangerousPatterns = [
    /[;`]/,                 // 命令分隔符、backtick
    /\|(?!\s*$)/,           // 管道（除了行末）
    /&&|\|\|/,              // 邏輯操作符
    /\$\(/,                 // 命令替換
    /\brm\s+-rf\b/i,        // rm -rf
    /\bsudo\b/i,            // sudo
  ];
  return !dangerousPatterns.some(p => p.test(command));
}

interface PortStatus {
  projectId: string;
  port: number;
  isRunning: boolean;
  pid?: number;
  projectPath?: string;
  memoryMB?: number;
  cpuPercent?: number;
  source?: 'brickverse' | 'coursefiles' | 'utility'
  devBasePath?: string;
}

interface SystemMemory {
  pressureLevel: 'normal' | 'warning' | 'critical';
  usedGB: number;
  totalGB: number;
  usedPercent: number;
  suggestedStops: string[];
  topProcesses: ExternalProcess[];
}

interface ExternalProcess {
  name: string;
  memoryMB: number;
}

// 取得系統 CPU 使用率（macOS top -l 1）
async function getSystemCpu(): Promise<number | null> {
  try {
    const { stdout } = await execAsync('top -l 1 -n 0 -s 0 | grep "CPU usage"');
    // "CPU usage: 12.5% user, 8.3% sys, 79.1% idle"
    const m = stdout.match(/([\d.]+)%\s+idle/);
    if (!m) return null;
    return Math.round((100 - parseFloat(m[1])) * 10) / 10;
  } catch {
    return null;
  }
}

// 取得系統記憶體資訊（macOS vm_stat + sysctl）
async function getSystemMemory(): Promise<SystemMemory | null> {
  try {
    const [{ stdout: vmOut }, { stdout: sysctlOut }] = await Promise.all([
      execAsync('vm_stat'),
      execAsync('sysctl -n hw.memsize'),
    ]);

    const totalBytes = parseInt(sysctlOut.trim());
    const totalGB = totalBytes / 1024 / 1024 / 1024;

    // Parse vm_stat pages
    const pageSize = 16384; // Apple Silicon page size
    const get = (label: string) => {
      const m = vmOut.match(new RegExp(`${label}:\\s+(\\d+)`));
      return m ? parseInt(m[1]) : 0;
    };

    const free = get('Pages free');
    const inactive = get('Pages inactive');
    const speculative = get('Pages speculative');
    const purgeable = get('Pages purgeable');
    // macOS 的 inactive + purgeable + free + speculative 都是可回收的
    const availablePages = free + inactive + speculative + purgeable;
    const availableGB = (availablePages * pageSize) / 1024 / 1024 / 1024;
    const usedGB = totalGB - availableGB;
    const usedPercent = Math.round((usedGB / totalGB) * 100);

    let pressureLevel: SystemMemory['pressureLevel'] = 'normal';
    if (usedPercent >= 88) pressureLevel = 'critical';
    else if (usedPercent >= 75) pressureLevel = 'warning';

    return { pressureLevel, usedGB: Math.round(usedGB * 10) / 10, totalGB: Math.round(totalGB * 10) / 10, usedPercent, suggestedStops: [], topProcesses: [] };
  } catch {
    return null;
  }
}

// 不列入建議的系統/開發相關進程
const IGNORED_PROCESSES = new Set([
  'kernel_task', 'WindowServer', 'launchd', 'loginwindow', 'Finder',
  'SystemUIServer', 'Dock', 'mds_stores', 'mds', 'mdworker',
  'coreaudiod', 'bluetoothd', 'syslogd', 'configd', 'opendirectoryd',
  'distnoted', 'usermanagerd', 'symptomsd', 'trustd', 'securityd',
  'TCIM_Extension', 'containermanagerd', 'backupd', 'bird',
]);

// 開發相關的進程關鍵字（不列入外部軟體建議）
const DEV_PROCESS_KEYWORDS = ['node', 'next-server', 'npm', 'claude', 'playwright', 'chrome-devtools-mcp', 'tsserver', 'typescript'];

// 從 comm 路徑提取 app 名稱（合併同一 app 的子進程）
function extractAppName(comm: string): string | null {
  // /Applications/XXX.app/... → XXX
  const appMatch = comm.match(/\/Applications\/([^/]+)\.app\//);
  if (appMatch) return appMatch[1];
  // "XXX Helper" / "XXX Helper (Renderer)" 等 → XXX
  const helperMatch = comm.match(/^([A-Za-z]+)\s+Helper/);
  if (helperMatch) return helperMatch[1];
  // 其他路徑取最後一段
  const parts = comm.split('/');
  const name = parts[parts.length - 1];
  if (!name) return null;
  // 清理括號、冒號、方括號後的描述（如 "tsserver[5.9.2]" → "tsserver"）
  return name.replace(/\s*[:([].*$/, '').trim() || null;
}

// 取得佔記憶體最多的外部應用程式
async function getTopProcesses(): Promise<ExternalProcess[]> {
  try {
    const { stdout } = await execAsync('ps axo rss,comm', { timeout: 5000 });
    const lines = stdout.trim().split('\n').slice(1); // 跳過 header

    // 合併同一 app 的記憶體
    const appMemory = new Map<string, number>();

    for (const line of lines) {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (!match) continue;
      const rssKB = parseInt(match[1]);
      const comm = match[2].trim();
      if (rssKB < 50000) continue; // 跳過 < 50MB 的小進程

      // 過濾開發相關進程
      const commLower = comm.toLowerCase();
      if (DEV_PROCESS_KEYWORDS.some(kw => commLower.includes(kw))) continue;

      const appName = extractAppName(comm);
      if (!appName || IGNORED_PROCESSES.has(appName)) continue;

      const memMB = Math.round(rssKB / 1024);
      appMemory.set(appName, (appMemory.get(appName) || 0) + memMB);
    }

    // 按記憶體排序，取前 5
    return [...appMemory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .filter(([, mb]) => mb >= 100) // 至少 100MB 才值得建議
      .map(([name, memoryMB]) => ({ name, memoryMB }));
  } catch {
    return [];
  }
}

// 取得單一 process 的 RSS 記憶體（MB）
async function getProcessMemory(pid: number): Promise<number | undefined> {
  try {
    const { stdout } = await execAsync(`ps -o rss= -p ${pid}`);
    const rssKB = parseInt(stdout.trim());
    if (isNaN(rssKB)) return undefined;
    return Math.round(rssKB / 1024);
  } catch {
    return undefined;
  }
}

// 取得單一 process 的 CPU 使用率（%）
async function getProcessCpu(pid: number): Promise<number | undefined> {
  try {
    const { stdout } = await execAsync(`ps -o %cpu= -p ${pid}`);
    const cpu = parseFloat(stdout.trim());
    if (isNaN(cpu)) return undefined;
    return Math.round(cpu * 10) / 10; // 精確到小數點後一位
  } catch {
    return undefined;
  }
}

// Check if a port is in use and get process info
async function checkPort(port: number): Promise<{ isRunning: boolean; pid?: number; pgid?: number; cwd?: string }> {
  try {
    const { stdout } = await execAsync(`lsof -i:${port} -P -t -sTCP:LISTEN 2>/dev/null`);
    const pid = parseInt(stdout.trim().split('\n')[0]);
    if (pid) {
      // Get the process group ID for killing the entire process tree
      let pgid: number | undefined;
      try {
        const { stdout: pgidOutput } = await execAsync(`ps -o pgid= -p ${pid}`);
        const parsed = parseInt(pgidOutput.trim());
        pgid = isNaN(parsed) ? undefined : parsed;
      } catch {
        pgid = undefined;
      }
      // Get the working directory of the process
      try {
        const { stdout: cwdOutput } = await execAsync(`lsof -p ${pid} | grep cwd | awk '{print $NF}'`);
        return { isRunning: true, pid, pgid, cwd: cwdOutput.trim() };
      } catch {
        return { isRunning: true, pid, pgid };
      }
    }
    return { isRunning: false };
  } catch {
    return { isRunning: false };
  }
}

// GET - Get status of all dev servers
export async function GET() {
  try {
    // Return cached response if fresh (prevents polling from multiple components saturating event loop)
    if (cachedGetResponse && Date.now() - cachedGetResponse.timestamp < GET_CACHE_TTL) {
      return NextResponse.json(cachedGetResponse.data);
    }

    const brickverseProjects = await readJsonFile<Project>('projects.json');
    const courseFiles = await readJsonFile<Project>('coursefiles.json');
    const utilityTools = await readJsonFile<Project>('utility-tools.json');
    const brickverseFlat = flattenProjectsWithChildren(brickverseProjects).map(p => ({ ...p, source: 'brickverse' as const }));
    const courseFlat = flattenProjectsWithChildren(courseFiles).map(p => ({ ...p, source: 'coursefiles' as const }));
    const utilityFlat = flattenProjectsWithChildren(utilityTools).map(p => ({ ...p, source: 'utility' as const }));
    const projects = [...brickverseFlat, ...courseFlat, ...utilityFlat];

    // Check all ports in parallel instead of serial
    const projectsWithPort = projects.filter(p => p.devPort);
    const statuses: PortStatus[] = await Promise.all(
      projectsWithPort.map(async (project) => {
        const portInfo = await checkPort(project.devPort!);
        let memoryMB: number | undefined;
        let cpuPercent: number | undefined;
        if (portInfo.isRunning && portInfo.pid) {
          [memoryMB, cpuPercent] = await Promise.all([
            getProcessMemory(portInfo.pid),
            getProcessCpu(portInfo.pid),
          ]);
        }
        return {
          projectId: project.id,
          port: project.devPort!,
          isRunning: portInfo.isRunning,
          pid: portInfo.pid,
          projectPath: project.path,
          memoryMB,
          cpuPercent,
          source: project.source,
          devBasePath: project.devBasePath,
        };
      })
    );

    // 取得系統記憶體 + CPU + 外部軟體記憶體（並行）
    const [systemMemory, systemCpu, topProcesses] = await Promise.all([
      getSystemMemory(),
      getSystemCpu(),
      getTopProcesses(),
    ]);
    if (systemMemory) {
      systemMemory.topProcesses = topProcesses;
      // warning/critical 時額外建議關閉 dev server
      if (systemMemory.pressureLevel !== 'normal') {
        const runningServers = statuses
          .filter(s => s.isRunning && s.memoryMB && s.port !== DASHBOARD_PORT)
          .sort((a, b) => (b.memoryMB || 0) - (a.memoryMB || 0));
        const count = systemMemory.pressureLevel === 'critical' ? 3 : 2;
        systemMemory.suggestedStops = runningServers.slice(0, count).map(s => s.projectId);
      }
    }

    const responseData = { data: statuses, systemMemory, systemCpu };
    cachedGetResponse = { data: responseData, timestamp: Date.now() };
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error getting dev server status:', error);
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}

// POST - Start or stop a dev server, or kill an external app
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, projectId } = body;

    // 關閉外部應用（不需要 projectId）
    if (action === 'kill-app') {
      const appName = body.appName as string;
      // Whitelist validation: only allow alphanumeric, spaces, hyphens, and dots
      if (!appName || !/^[a-zA-Z0-9\s\-\.]+$/.test(appName)) {
        return NextResponse.json({ error: 'Invalid app name' }, { status: 400 });
      }
      try {
        await execAsync(`osascript -e 'quit app "${appName}"'`, { timeout: 5000 });
        await logEvent(`Quit app: ${appName}`);
        return NextResponse.json({ message: `已關閉 ${appName}` });
      } catch {
        return NextResponse.json({ error: `無法關閉 ${appName}` }, { status: 500 });
      }
    }

    // pm2 restart（不需要 devPort）
    if (action === 'pm2-restart') {
      const appName = body.pm2AppName || 'todo-dashboard';
      // Whitelist validation: only allow alphanumeric, hyphens, and underscores
      if (!/^[a-zA-Z0-9\-_]+$/.test(appName)) {
        return NextResponse.json({ error: 'Invalid pm2 app name' }, { status: 400 });
      }
      try {
        // 使用 nohup + 延時，避免 PM2 自我重啟時殺死當前 process 導致命令失敗
        await execAsync(`nohup bash -c 'sleep 1 && /opt/homebrew/bin/pm2 restart ${appName}' > /dev/null 2>&1 &`);
        await logEvent(`pm2 restart ${appName} (delayed)`);
        return NextResponse.json({ success: true, message: `pm2 restart ${appName} 已排程（1 秒後執行）` });
      } catch (error) {
        return NextResponse.json(
          { error: `pm2 restart 失敗: ${error instanceof Error ? error.message : String(error)}` },
          { status: 500 }
        );
      }
    }

    const projects = await loadAllProjects();
    const project = projects.find(p => p.id === projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (!project.devPort) {
      return NextResponse.json({ error: 'Project has no devPort configured' }, { status: 400 });
    }

    if (action === 'start') {
      // Check if already running
      const portInfo = await checkPort(project.devPort);
      if (portInfo.isRunning) {
        return NextResponse.json({
          error: `Port ${project.devPort} is already in use`,
          pid: portInfo.pid
        }, { status: 409 });
      }

      // Start the dev server
      const projectPath = project.devPath || project.path;

      // 驗證專案資料夾是否存在
      try {
        const folderStat = await stat(projectPath);
        if (!folderStat.isDirectory()) {
          return NextResponse.json({ error: `路徑不是資料夾：${projectPath}` }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: `專案資料夾不存在：${projectPath}` }, { status: 400 });
      }

      // 若無自訂 devCommand，檢查 package.json 是否存在
      if (!project.devCommand) {
        try {
          await access(path.join(projectPath, 'package.json'));
        } catch {
          return NextResponse.json({ error: `專案缺少 package.json，無法啟動 dev server` }, { status: 400 });
        }
      }

      // 驗證 devCommand 安全性
      if (project.devCommand && !isCommandSafe(project.devCommand)) {
        return NextResponse.json({ error: 'devCommand 包含不安全的字元' }, { status: 400 });
      }

      const fullCommand = project.devCommand
        ? `cd "${projectPath}" && ${project.devCommand}`
        : `cd "${projectPath}" && npm run dev -- -p ${project.devPort}`;
      // Capture stderr to per-port log file for crash diagnostics
      let stderrFd: number | undefined;
      try {
        stderrFd = openSync(
          path.join(process.cwd(), `.dev-server-${project.devPort}.log`),
          'a'
        );
      } catch {}
      const child = spawn('sh', ['-c', fullCommand], {
        detached: true,
        stdio: stderrFd !== undefined ? ['ignore', 'ignore', stderrFd] : 'ignore',
      });
      child.unref();

      // Poll the port until the server is ready (check every 1s, up to 10s)
      let newPortInfo: Awaited<ReturnType<typeof checkPort>> = { isRunning: false };
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        newPortInfo = await checkPort(project.devPort);
        if (newPortInfo.isRunning) break;
      }

      return NextResponse.json({
        success: true,
        message: newPortInfo.isRunning
          ? `Started ${project.name} on port ${project.devPort}`
          : `${project.name} is starting on port ${project.devPort}...`,
        isRunning: newPortInfo.isRunning,
        pid: newPortInfo.pid,
      });

    } else if (action === 'stop') {
      const portInfo = await checkPort(project.devPort);
      if (!portInfo.isRunning) {
        return NextResponse.json({ error: 'Server is not running' }, { status: 400 }
        );
      }

      // Kill the process, but avoid killing our own process group
      try {
        let dashboardPgid: number | undefined;
        try {
          const { stdout: pgidOut } = await execAsync(`ps -o pgid= -p ${process.pid}`);
          const parsed = parseInt(pgidOut.trim());
          dashboardPgid = isNaN(parsed) ? undefined : parsed;
        } catch {
          dashboardPgid = undefined;
        }

        const targetPgid = portInfo.pgid;
        // Only use group kill when BOTH PGIDs are valid numbers AND different
        const canKillGroup =
          targetPgid !== undefined &&
          !isNaN(targetPgid) &&
          dashboardPgid !== undefined &&
          targetPgid !== dashboardPgid;

        if (canKillGroup) {
          await logEvent(`KILL_GROUP pgid=${targetPgid} port=${project.devPort} project=${project.name}`);
          await execAsync(`kill -- -${targetPgid}`);
        } else {
          await logEvent(`KILL_PID pid=${portInfo.pid} port=${project.devPort} project=${project.name} (dashboardPgid=${dashboardPgid}, targetPgid=${targetPgid})`);
          await execAsync(`kill ${portInfo.pid}`);
        }
        // Wait a moment for processes to terminate
        await new Promise(resolve => setTimeout(resolve, 500));
        return NextResponse.json({
          success: true,
          message: `Stopped ${project.name}`,
        });
      } catch (error) {
        await logEvent(`KILL_FAILED port=${project.devPort} error=${error instanceof Error ? error.message : String(error)}`);
        return NextResponse.json({ error: 'Failed to stop server' }, { status: 500 });
      }

    } else if (action === 'open-cursor') {
      const projectPath = project.devPath || project.path;
      const child = spawn('open', ['-a', 'Cursor', projectPath], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return NextResponse.json({ success: true, message: `Opening ${project.name} in Cursor` });

    } else if (action === 'open-browser') {
      const url = `http://localhost:${project.devPort}${project.devBasePath || ''}`;
      // 用 AppleScript 呼叫 Dia 瀏覽器開啟（CourseFiles 專案走此路徑）
      try {
        await execAsync(`osascript -e 'tell application "Dia" to open location "${url}"'`);
        return NextResponse.json({ success: true, message: `Opening ${url} in Dia` });
      } catch (error) {
        console.error('Failed to open Dia:', error);
        return NextResponse.json({ error: `無法開啟 Dia：${error instanceof Error ? error.message : '未知錯誤'}` }, { status: 500 });
      }

    } else if (action === 'restart') {
      // 重啟 dev server：spawn 一個 detached script 來 kill → 重新啟動
      const projectPath = project.devPath || project.path;
      const port = project.devPort;
      const devCmd = project.devCommand || `npx next dev -p ${port}`;

      // Validate projectPath to prevent path traversal
      const allowedBases = ['/Users/ruanbaiye/Documents/Brickverse'];
      const resolved = path.resolve(projectPath);
      if (!allowedBases.some(base => resolved.startsWith(base))) {
        return NextResponse.json({ error: 'Invalid project path' }, { status: 403 });
      }

      // 用 bash -c 執行：先殺掉 port 上的 process，等 1 秒再重新啟動
      const script = `
        sleep 0.5
        PID=$(lsof -ti :${port} 2>/dev/null)
        if [ -n "$PID" ]; then
          kill $PID 2>/dev/null
          sleep 1
        fi
        cd "${projectPath}" && ${devCmd} &
      `;
      const child = spawn('bash', ['-c', script], {
        detached: true,
        stdio: 'ignore',
        cwd: projectPath,
      });
      child.unref();

      await logEvent(`Restart requested for ${project.name} (port ${port})`);
      return NextResponse.json({ success: true, message: `正在重啟 ${project.name} (port ${port})` });

    } else if (action === 'start-production') {
      // 啟動 Production server (PM2, port 3001)
      const PROD_PORT = 3001;
      const prodPortInfo = await checkPort(PROD_PORT);

      if (prodPortInfo.isRunning) {
        return NextResponse.json({ success: true, message: `Production server 已在 port ${PROD_PORT} 運行`, alreadyRunning: true });
      }

      const projectPath = process.cwd();
      const child = spawn('sh', ['-c', `cd "${projectPath}" && npx next start -p ${PROD_PORT}`], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();

      // Poll 等待 server 就緒（每 500ms 檢查，最多 8 秒）
      let ready = false;
      for (let i = 0; i < 16; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const info = await checkPort(PROD_PORT);
        if (info.isRunning) { ready = true; break; }
      }

      await logEvent(`Production server ${ready ? 'started' : 'starting'} on port ${PROD_PORT}`);
      return NextResponse.json({
        success: true,
        message: ready ? `Production server 已啟動 (port ${PROD_PORT})` : `Production server 啟動中 (port ${PROD_PORT})...`,
        isRunning: ready,
      });

    } else if (action === 'stop-production') {
      // 停止 Production server (PM2, port 3001)
      const PROD_PORT = 3001;
      const prodPortInfo = await checkPort(PROD_PORT);

      if (!prodPortInfo.isRunning) {
        return NextResponse.json({ error: 'Production server 未在運行' }, { status: 400 });
      }

      try {
        await execAsync(`kill ${prodPortInfo.pid}`);
        await new Promise(resolve => setTimeout(resolve, 500));
        await logEvent(`Production server stopped (port ${PROD_PORT}, pid ${prodPortInfo.pid})`);
        return NextResponse.json({ success: true, message: `Production server 已停止` });
      } catch (error) {
        await logEvent(`KILL_FAILED production port=${PROD_PORT} error=${error instanceof Error ? error.message : String(error)}`);
        return NextResponse.json({ error: '無法停止 Production server' }, { status: 500 });
      }

    } else if (action === 'check-production') {
      // 檢查 Production server 狀態
      const PROD_PORT = 3001;
      const prodPortInfo = await checkPort(PROD_PORT);
      let memoryMB: number | undefined;
      let cpuPercent: number | undefined;
      if (prodPortInfo.isRunning && prodPortInfo.pid) {
        memoryMB = await getProcessMemory(prodPortInfo.pid);
        cpuPercent = await getProcessCpu(prodPortInfo.pid);
      }
      return NextResponse.json({
        isRunning: prodPortInfo.isRunning,
        pid: prodPortInfo.pid,
        port: PROD_PORT,
        memoryMB,
        cpuPercent,
      });

    } else {
      return NextResponse.json({ error: 'Invalid action. Use "start", "stop", "restart", "open-cursor", "open-browser", "start-production", "stop-production", or "check-production"' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error handling dev server action:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
