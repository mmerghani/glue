import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import { ServerInstaller } from './serverInstaller.js';

const DEFAULT_PORT = 3001;
const DEFAULT_LOCAL_MODEL_PORT = 8000;
const DEFAULT_LOCAL_MODEL_ID = 'mlx-community/gemma-4-e4b-it-4bit';
const DEFAULT_LOCAL_MODEL_LOG_PATH = path.join(os.tmpdir(), 'glue-desktop-model-server.log');
const HOST = '127.0.0.1';
const DISPLAY_HOST = 'localhost';
const HEALTH_TIMEOUT_MS = 1000;
const SERVER_START_TIMEOUT_MS = 30000;
const LOCAL_MODEL_START_TIMEOUT_MS = 180000;
const MAX_STARTUP_LOG_LINES = 300;
const SERVER_MARKER_PATH = path.join(os.homedir(), '.cloudcli', 'local-server.json');
const LOCAL_SERVER_URL_ENV_KEYS = [
  'CLOUDCLI_DESKTOP_LOCAL_SERVER_URL',
  'CLOUDCLI_LOCAL_SERVER_URL',
  'ELECTRON_LOCAL_SERVER_URL',
];
const LOCAL_SERVER_PORT_ENV_KEYS = [
  'CLOUDCLI_DESKTOP_LOCAL_SERVER_PORT',
  'CLOUDCLI_SERVER_PORT',
  'SERVER_PORT',
  'PORT',
];

function requestJson(url, timeoutMs = HEALTH_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            json: JSON.parse(body),
          });
        } catch {
          resolve({ ok: false, json: null });
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, json: null });
    });
    req.on('error', () => resolve({ ok: false, json: null }));
  });
}

async function isCloudCliServer(baseUrl) {
  const response = await requestJson(`${baseUrl}/health`);
  return response.ok
    && response.json?.status === 'ok'
    && typeof response.json?.installMode === 'string';
}

function redirectsToViteDevServer(location) {
  if (!location) return false;
  try {
    const parsed = new URL(String(location));
    return (parsed.hostname === 'localhost' || parsed.hostname === HOST)
      && parsed.port === '5173';
  } catch {
    return false;
  }
}

function hasReusableAppRoot(baseUrl, timeoutMs = HEALTH_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const req = http.get(baseUrl, { timeout: timeoutMs }, (res) => {
      const isDevRedirect = res.statusCode >= 300
        && res.statusCode < 400
        && redirectsToViteDevServer(res.headers.location);
      res.resume();
      resolve(!isDevRedirect);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function isReusableCloudCliServer(baseUrl) {
  if (!(await isCloudCliServer(baseUrl))) {
    return false;
  }

  return hasReusableAppRoot(baseUrl);
}

function getLocalModelLabel(modelId) {
  return String(modelId || '').replace(/^mlx-community\//, '');
}

function getDefaultLocalModelOption() {
  return {
    id: DEFAULT_LOCAL_MODEL_ID,
    label: getLocalModelLabel(DEFAULT_LOCAL_MODEL_ID),
  };
}

function getDefaultDesktopSettings() {
  return {
    keepLocalServerRunning: false,
    exposeLocalServerOnNetwork: false,
    themeMode: 'system',
    selectedLocalModel: DEFAULT_LOCAL_MODEL_ID,
  };
}

function parseConfiguredLocalModelIds(scriptContent) {
  const match = String(scriptContent || '').match(/MODEL_IDS=\(([\s\S]*?)\n\)/);
  if (!match) {
    return [DEFAULT_LOCAL_MODEL_ID];
  }

  const ids = Array.from(match[1].matchAll(/"(mlx-community\/[^"]+)"/g), ([, modelId]) => modelId);
  return ids.length ? ids : [DEFAULT_LOCAL_MODEL_ID];
}

async function getLocalModelOptions(homeDir = os.homedir()) {
  const runScriptPath = path.join(homeDir, 'claude-code-local', 'run.sh');
  const hubPath = path.join(homeDir, '.cache', 'huggingface', 'hub');

  let configuredIds = [DEFAULT_LOCAL_MODEL_ID];
  try {
    configuredIds = parseConfiguredLocalModelIds(await fs.readFile(runScriptPath, 'utf8'));
  } catch {
    configuredIds = [DEFAULT_LOCAL_MODEL_ID];
  }

  const options = await Promise.all(configuredIds.map(async (modelId) => ({
    id: modelId,
    label: getLocalModelLabel(modelId),
    downloaded: await pathExists(path.join(hubPath, `models--${modelId.replace(/\//g, '--')}`)),
  })));

  const visibleOptions = options.some((option) => option.downloaded)
    ? options.filter((option) => option.downloaded)
    : options;
  return visibleOptions.map(({ id, label }) => ({ id, label }));
}

function normalizeSelectedLocalModel(selectedLocalModel, availableLocalModels) {
  const modelId = String(selectedLocalModel || '').trim();
  const validIds = new Set((availableLocalModels || []).map((option) => option.id));

  if (modelId && (!validIds.size || validIds.has(modelId))) {
    return modelId;
  }
  if (validIds.size) {
    return availableLocalModels[0].id;
  }
  return DEFAULT_LOCAL_MODEL_ID;
}

async function isLocalModelBackendServing(baseUrl, modelId) {
  const response = await requestJson(`${baseUrl}/v1/models`);
  if (!response.ok || !Array.isArray(response.json?.data)) {
    return false;
  }

  return response.json.data.some((entry) => entry?.id === modelId);
}

function isPortAvailable(port, host = HOST) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', reject);
    server.once('listening', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : DEFAULT_PORT;
      server.close(() => resolve(port));
    });
    server.listen(0, HOST);
  });
}

async function chooseServerPort(host) {
  if (await isPortAvailable(DEFAULT_PORT, host)) {
    return DEFAULT_PORT;
  }

  return getFreePort();
}

function getDesktopPath() {
  const currentPath = process.env.PATH || '';
  const commonPaths = process.platform === 'win32'
    ? []
    : ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];

  return [...commonPaths, currentPath].filter(Boolean).join(path.delimiter);
}

function getNodeRuntime(usePackagedElectronRuntime) {
  if (process.env.ELECTRON_NODE_PATH) {
    return { command: process.env.ELECTRON_NODE_PATH, env: {}, label: 'ELECTRON_NODE_PATH' };
  }

  if (usePackagedElectronRuntime && process.versions.electron) {
    return {
      command: process.execPath,
      env: { ELECTRON_RUN_AS_NODE: '1' },
      label: `Electron ${process.versions.electron} Node ${process.versions.node}`,
    };
  }

  if (process.env.npm_node_execpath) {
    return { command: process.env.npm_node_execpath, env: {}, label: 'npm_node_execpath' };
  }

  return { command: 'node', env: {}, label: 'PATH node' };
}

function stripTrailingSlash(value) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function addCandidateUrl(urls, rawUrl) {
  if (!rawUrl) return;
  try {
    const parsed = new URL(String(rawUrl));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
    parsed.hash = '';
    parsed.search = '';
    const normalized = stripTrailingSlash(parsed.toString());
    if (!urls.includes(normalized)) urls.push(normalized);
  } catch {
    // Ignore invalid user-provided discovery values.
  }
}

function addCandidatePort(urls, rawPort) {
  const port = Number.parseInt(String(rawPort || ''), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return;
  addCandidateUrl(urls, `http://${HOST}:${port}`);
}

function getPortFromUrl(baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.port) return Number.parseInt(parsed.port, 10);
    return parsed.protocol === 'https:' ? 443 : 80;
  } catch {
    return null;
  }
}

function getDisplayUrl(baseUrl) {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.hostname === HOST) {
      parsed.hostname = DISPLAY_HOST;
    }
    return stripTrailingSlash(parsed.toString());
  } catch {
    return baseUrl;
  }
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readServerBundleConfig(appRoot) {
  try {
    const raw = await fs.readFile(path.join(appRoot, 'electron', 'server-bundle-config.json'), 'utf8');
    const config = JSON.parse(raw);
    return {
      releaseTag: typeof config.releaseTag === 'string' && config.releaseTag.trim()
        ? config.releaseTag.trim()
        : '',
    };
  } catch {
    return { releaseTag: '' };
  }
}

function getServerCwd(appRoot, serverEntry) {
  const normalizedEntry = path.resolve(serverEntry);
  const bundledEntry = path.resolve(appRoot, 'dist-server', 'server', 'index.js');
  if (normalizedEntry === bundledEntry) {
    return appRoot;
  }

  // Installed server entries are laid out as <root>/dist-server/server/index.js.
  return path.resolve(path.dirname(normalizedEntry), '..', '..');
}

async function readServerMarkerUrl() {
  try {
    const raw = await fs.readFile(SERVER_MARKER_PATH, 'utf8');
    const marker = JSON.parse(raw);
    return marker.url || (marker.port ? `http://${marker.host || HOST}:${marker.port}` : null);
  } catch {
    return null;
  }
}

async function getExistingServerCandidateUrls(defaultUrl) {
  const urls = [];

  for (const key of LOCAL_SERVER_URL_ENV_KEYS) {
    addCandidateUrl(urls, process.env[key]);
  }

  addCandidateUrl(urls, await readServerMarkerUrl());

  for (const key of LOCAL_SERVER_PORT_ENV_KEYS) {
    addCandidatePort(urls, process.env[key]);
  }

  addCandidateUrl(urls, defaultUrl);
  return urls;
}

async function waitForCloudCliServer(baseUrl, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isCloudCliServer(baseUrl)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return false;
}

function isEndpointHealthy(url, timeoutMs = HEALTH_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

async function waitForHealthyEndpoint(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isEndpointHealthy(url)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return false;
}

function resolveLocalModelConfig(env = process.env, homeDir = os.homedir(), selectedLocalModel = null) {
  const parsedPort = Number.parseInt(String(env.GLUE_DESKTOP_MODEL_PORT || DEFAULT_LOCAL_MODEL_PORT), 10);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
    ? parsedPort
    : DEFAULT_LOCAL_MODEL_PORT;
  const modelId = String(selectedLocalModel || env.GLUE_DESKTOP_MODEL || env.ANTHROPIC_MODEL || DEFAULT_LOCAL_MODEL_ID);

  return {
    modelId,
    baseUrl: `http://${HOST}:${port}`,
    port,
    runScriptPath: path.join(homeDir, 'claude-code-local', 'run.sh'),
    logPath: DEFAULT_LOCAL_MODEL_LOG_PATH,
  };
}

function buildLocalModelEnvironment(modelId, baseUrl = `http://${HOST}:${DEFAULT_LOCAL_MODEL_PORT}`) {
  return {
    CLAUDE_CODE_BASH_TIMEOUT: '600000',
    ANTHROPIC_BASE_URL: baseUrl,
    ANTHROPIC_API_KEY: 'not-needed',
    ANTHROPIC_MODEL: modelId,
    ANTHROPIC_DEFAULT_OPUS_MODEL: modelId,
    ANTHROPIC_DEFAULT_SONNET_MODEL: modelId,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: modelId,
    CLAUDE_CODE_SUBAGENT_MODEL: modelId,
    CLAUDE_CODE_MAX_OUTPUT_TOKENS: '16384',
    CLAUDE_CODE_ATTRIBUTION_HEADER: '0',
    DISABLE_AUTOUPDATER: '1',
    DISABLE_TELEMETRY: '1',
    DISABLE_ERROR_REPORTING: '1',
    DISABLE_NON_ESSENTIAL_MODEL_CALLS: '1',
  };
}

function renderDotEnvFile(envMap) {
  return Object.keys(envMap)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `${key}=${envMap[key]}`)
    .join('\n') + '\n';
}

function mergeDotEnvFile(existingContent, envMap) {
  const managedKeys = new Set(Object.keys(envMap));
  const preservedLines = existingContent
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return true;
      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) return true;
      const key = line.slice(0, separatorIndex).trim();
      return !managedKeys.has(key);
    })
    .filter((line, index, lines) => !(index === lines.length - 1 && line === ''));

  const rendered = renderDotEnvFile(envMap).trimEnd();
  if (!preservedLines.length) {
    return `${rendered}\n`;
  }

  return `${preservedLines.join('\n').replace(/\n+$/, '')}\n${rendered}\n`;
}

export class LocalServerController {
  constructor({ appRoot, settingsPath, isPackaged = false, appVersion, onChange, homeDir = os.homedir() }) {
    this.appRoot = appRoot;
    this.settingsPath = settingsPath;
    this.isPackaged = isPackaged;
    this.appVersion = appVersion;
    this.onChange = onChange;
    this.homeDir = homeDir;
    this.localServerUrl = null;
    this.localServerPort = null;
    this.localServerPromise = null;
    this.ownedServerProcess = null;
    this.ownedModelProcess = null;
    this.startupLogs = [];
    this.availableLocalModels = [getDefaultLocalModelOption()];
    this.desktopSettings = getDefaultDesktopSettings();
  }

  getSettings() {
    return this.desktopSettings;
  }

  getAvailableLocalModels() {
    return [...this.availableLocalModels];
  }

  getSelectedLocalModel() {
    return normalizeSelectedLocalModel(this.desktopSettings.selectedLocalModel, this.availableLocalModels);
  }

  getLocalServerUrl() {
    return this.localServerUrl;
  }

  getHealthCheckUrl() {
    if (!this.localServerPort) return this.localServerUrl;
    return `http://${HOST}:${this.localServerPort}`;
  }

  appendStartupLog(line) {
    const text = String(line || '').trimEnd();
    if (!text) return;
    const timestamp = new Date().toLocaleTimeString();
    this.startupLogs.push(`[${timestamp}] ${text}`);
    if (this.startupLogs.length > MAX_STARTUP_LOG_LINES) {
      this.startupLogs.splice(0, this.startupLogs.length - MAX_STARTUP_LOG_LINES);
    }
    this.onChange?.();
  }

  getStartupLogs() {
    return [...this.startupLogs];
  }

  getPendingTarget() {
    return {
      kind: 'local',
      name: 'Local Glue',
      url: this.localServerUrl || `http://${DISPLAY_HOST}:${this.localServerPort || DEFAULT_PORT}`,
    };
  }

  getLanAddress() {
    const interfaces = os.networkInterfaces();
    for (const entries of Object.values(interfaces)) {
      for (const entry of entries || []) {
        if (entry.family === 'IPv4' && !entry.internal) {
          return entry.address;
        }
      }
    }
    return null;
  }

  getShareableWebUrl() {
    if (!this.localServerUrl || !this.localServerPort) return null;
    if (this.desktopSettings.exposeLocalServerOnNetwork) {
      const lanAddress = this.getLanAddress();
      if (lanAddress) {
        return `http://${lanAddress}:${this.localServerPort}`;
      }
    }
    return this.getLocalServerUrl();
  }

  getServerBindHost() {
    return this.desktopSettings.exposeLocalServerOnNetwork ? '0.0.0.0' : HOST;
  }

  async loadDesktopSettings() {
    this.availableLocalModels = await getLocalModelOptions(this.homeDir);

    try {
      const raw = await fs.readFile(this.settingsPath, 'utf8');
      const stored = JSON.parse(raw);
      this.desktopSettings = {
        keepLocalServerRunning: Boolean(stored.keepLocalServerRunning),
        exposeLocalServerOnNetwork: Boolean(stored.exposeLocalServerOnNetwork),
        themeMode: stored.themeMode === 'light' || stored.themeMode === 'dark' ? stored.themeMode : 'system',
        selectedLocalModel: normalizeSelectedLocalModel(stored.selectedLocalModel, this.availableLocalModels),
      };
    } catch {
      this.desktopSettings = {
        ...getDefaultDesktopSettings(),
        selectedLocalModel: normalizeSelectedLocalModel(DEFAULT_LOCAL_MODEL_ID, this.availableLocalModels),
      };
    }
  }

  async saveDesktopSettings(nextSettings = this.desktopSettings) {
    if (
      nextSettings.selectedLocalModel
      && !this.availableLocalModels.some((option) => option.id === nextSettings.selectedLocalModel)
    ) {
      this.availableLocalModels = await getLocalModelOptions(this.homeDir);
    }

    this.desktopSettings = {
      keepLocalServerRunning: Boolean(nextSettings.keepLocalServerRunning),
      exposeLocalServerOnNetwork: Boolean(nextSettings.exposeLocalServerOnNetwork),
      themeMode: nextSettings.themeMode === 'light' || nextSettings.themeMode === 'dark' ? nextSettings.themeMode : 'system',
      selectedLocalModel: normalizeSelectedLocalModel(nextSettings.selectedLocalModel, this.availableLocalModels),
    };
    await fs.mkdir(path.dirname(this.settingsPath), { recursive: true });
    await fs.writeFile(this.settingsPath, JSON.stringify(this.desktopSettings, null, 2), 'utf8');
    this.onChange?.();
  }

  async updateDesktopSetting(key, value) {
    if (!Object.prototype.hasOwnProperty.call(this.desktopSettings, key)) {
      throw new Error(`Unknown desktop setting: ${key}`);
    }

    const wasExposeSetting = key === 'exposeLocalServerOnNetwork';
    const wasLocalRunning = Boolean(this.localServerUrl);
    const nextValue = key === 'themeMode' || key === 'selectedLocalModel' ? value : Boolean(value);
    await this.saveDesktopSettings({ ...this.desktopSettings, [key]: nextValue });

    return {
      desktopSettings: this.desktopSettings,
      requiresRestartNotice: wasExposeSetting && wasLocalRunning,
    };
  }

  async syncInstalledRuntimeBundle(versionDir) {
    if (!(await pathExists(versionDir))) {
      return false;
    }

    let copiedAny = false;
    for (const relativePath of ['dist', 'public', 'dist-server']) {
      const sourcePath = path.join(this.appRoot, relativePath);
      if (!(await pathExists(sourcePath))) continue;
      if (!copiedAny) {
        this.appendStartupLog(`Syncing Glue runtime into installed server ${this.appVersion}...`);
      }
      const targetPath = path.join(versionDir, relativePath);
      await fs.rm(targetPath, { recursive: true, force: true });
      await fs.cp(sourcePath, targetPath, { recursive: true, force: true });
      copiedAny = true;
    }

    const sourcePackageJson = path.join(this.appRoot, 'package.json');
    if (await pathExists(sourcePackageJson)) {
      if (!copiedAny) {
        this.appendStartupLog(`Syncing Glue runtime into installed server ${this.appVersion}...`);
      }
      await fs.copyFile(sourcePackageJson, path.join(versionDir, 'package.json'));
      copiedAny = true;
    }

    if (copiedAny) {
      this.appendStartupLog('Installed Glue runtime refreshed.');
    }
    return copiedAny;
  }

  /** Resolves the local server entry, installing the matching runtime if needed. */
  async resolveServerEntry() {
    if (process.env.ELECTRON_SERVER_ENTRY) {
      return process.env.ELECTRON_SERVER_ENTRY;
    }

    const bundledEntry = path.join(this.appRoot, 'dist-server', 'server', 'index.js');
    if (process.env.CLOUDCLI_USE_INSTALLED_SERVER !== '1' && await pathExists(bundledEntry)) {
      return bundledEntry;
    }

    if (!this.appVersion) {
      throw new Error('Cannot install local server: app version is unknown.');
    }
    const bundleConfig = await readServerBundleConfig(this.appRoot);
    const installer = new ServerInstaller({
      version: this.appVersion,
      bundleReleaseTag: bundleConfig.releaseTag,
      onLog: (line) => this.appendStartupLog(line),
    });
    const serverEntry = await installer.ensureInstalled();
    await this.syncInstalledRuntimeBundle(installer.getVersionDir());
    return serverEntry;
  }

  startBundledServer(port, serverEntry) {
    const bindHost = this.getServerBindHost();
    const runtime = getNodeRuntime(this.isPackaged);
    const serverCwd = getServerCwd(this.appRoot, serverEntry);

    const command = `${runtime.command} ${serverEntry}`;
    this.appendStartupLog(`$ ${command}`);
    this.appendStartupLog(`runtime: ${runtime.label}`);
    this.appendStartupLog(`cwd: ${serverCwd}`);
    this.appendStartupLog(`HOST=${bindHost} SERVER_PORT=${port}`);

    this.ownedServerProcess = spawn(runtime.command, [serverEntry], {
      cwd: serverCwd,
      detached: true,
      env: {
        ...process.env,
        ...runtime.env,
        HOST: bindHost,
        SERVER_PORT: String(port),
        PATH: getDesktopPath(),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.ownedServerProcess.once('error', (error) => {
      this.appendStartupLog(`failed to start process: ${error.message}`);
      this.ownedServerProcess = null;
    });

    this.ownedServerProcess.stdout?.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        this.appendStartupLog(line);
      }
    });

    this.ownedServerProcess.stderr?.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        this.appendStartupLog(`stderr: ${line}`);
      }
    });

    this.ownedServerProcess.once('exit', (code, signal) => {
      this.appendStartupLog(`process exited with code ${code ?? 'null'} and signal ${signal ?? 'null'}`);
      if (this.ownedServerProcess) {
        console.error(`Glue desktop server exited with code ${code ?? 'null'} and signal ${signal ?? 'null'}`);
      }
      this.ownedServerProcess = null;
    });
  }

  async resolveLocalServerUrl() {
    const defaultUrl = `http://${HOST}:${DEFAULT_PORT}`;
    const defaultDisplayUrl = `http://${DISPLAY_HOST}:${DEFAULT_PORT}`;
    const devUrl = process.env.ELECTRON_DEV_URL;
    const forceOwnServer = process.env.ELECTRON_FORCE_OWN_SERVER === '1';

    if (devUrl) {
      const ready = await waitForCloudCliServer(defaultUrl, SERVER_START_TIMEOUT_MS);
      if (!ready) {
        throw new Error(`Development backend did not become ready at ${defaultDisplayUrl}`);
      }
      this.localServerPort = DEFAULT_PORT;
      return devUrl;
    }

    let preferredRuntimeRoot = this.appRoot;
    if (this.appVersion) {
      const bundleConfig = await readServerBundleConfig(this.appRoot);
      const installer = new ServerInstaller({
        version: this.appVersion,
        bundleReleaseTag: bundleConfig.releaseTag,
        onLog: (line) => this.appendStartupLog(line),
      });
      const versionDir = installer.getVersionDir();
      await this.syncInstalledRuntimeBundle(versionDir);
      if (await pathExists(versionDir)) {
        preferredRuntimeRoot = versionDir;
      }
    }

    await this.ensureLocalModelBackend(preferredRuntimeRoot);

    if (!forceOwnServer) {
      const candidateUrls = await getExistingServerCandidateUrls(defaultUrl);
      for (const candidateUrl of candidateUrls) {
        if (await isReusableCloudCliServer(candidateUrl)) {
          const displayUrl = getDisplayUrl(candidateUrl);
          this.localServerPort = getPortFromUrl(candidateUrl);
          this.appendStartupLog(`Using existing Local Glue at ${displayUrl}`);
          return displayUrl;
        }
      }
    }

    const serverEntry = await this.resolveServerEntry();
    await this.ensureLocalModelBackend(getServerCwd(this.appRoot, serverEntry));

    const port = await chooseServerPort(this.getServerBindHost());
    const serverUrl = `http://${HOST}:${port}`;
    const displayUrl = `http://${DISPLAY_HOST}:${port}`;
    this.localServerPort = port;
    this.startBundledServer(port, serverEntry);

    const ready = await waitForCloudCliServer(serverUrl, SERVER_START_TIMEOUT_MS);
    if (!ready) {
      const recentLogs = this.getStartupLogs().slice(-20).join('\n');
      await this.shutdownOwnedServer();
      this.localServerPort = null;
      throw new Error([
        `Bundled backend did not become ready at ${displayUrl}.`,
        recentLogs ? `Recent startup output:\n${recentLogs}` : 'No startup output was captured.',
      ].join('\n\n'));
    }

    this.appendStartupLog(`Local Glue ready at ${displayUrl}`);
    this.localServerUrl = displayUrl;
    return displayUrl;
  }

  async ensureLocalServer() {
    if (this.localServerUrl) {
      return this.localServerUrl;
    }

    if (!this.localServerPromise) {
      this.localServerPromise = this.resolveLocalServerUrl()
        .then((url) => {
          this.localServerUrl = url;
          return url;
        })
        .catch((error) => {
          this.localServerPromise = null;
          throw error;
        });
    }

    return this.localServerPromise;
  }

  async getResolvedTarget() {
    await this.ensureLocalServer();
    return {
      kind: 'local',
      name: 'Local Glue',
      url: this.localServerUrl,
    };
  }

  async loadLocalTarget() {
    return {
      pendingTarget: this.getPendingTarget(),
      target: await this.getResolvedTarget(),
    };
  }

  async writeLocalModelRuntimeEnv(serverRoot, envMap) {
    if (!serverRoot || !(await pathExists(serverRoot))) {
      return;
    }

    const envPath = path.join(serverRoot, '.env');
    let existing = '';
    try {
      existing = await fs.readFile(envPath, 'utf8');
    } catch {
      existing = '';
    }

    await fs.writeFile(envPath, mergeDotEnvFile(existing, envMap), 'utf8');
  }

  attachOwnedModelProcessLogging(child, config) {
    child.once('error', (error) => {
      this.appendStartupLog(`local model backend failed to start: ${error.message}`);
      this.ownedModelProcess = null;
    });

    child.stdout?.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        this.appendStartupLog(`[model] ${line}`);
      }
    });

    child.stderr?.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        this.appendStartupLog(`[model] stderr: ${line}`);
      }
    });

    child.once('exit', (code, signal) => {
      this.appendStartupLog(`[model] process exited with code ${code ?? 'null'} and signal ${signal ?? 'null'}`);
      if (this.ownedModelProcess) {
        console.error(`Glue desktop model backend exited with code ${code ?? 'null'} and signal ${signal ?? 'null'}`);
      }
      this.ownedModelProcess = null;
    });

    this.appendStartupLog(`Local model logs: ${config.logPath}`);
  }

  async ensureLocalModelBackend(serverRoot = null) {
    const config = resolveLocalModelConfig(process.env, this.homeDir, this.getSelectedLocalModel());
    const envMap = buildLocalModelEnvironment(config.modelId, config.baseUrl);

    Object.assign(process.env, envMap);
    await this.writeLocalModelRuntimeEnv(serverRoot, envMap);

    const healthUrl = `${config.baseUrl}/health`;
    if (await isEndpointHealthy(healthUrl)) {
      if (await isLocalModelBackendServing(config.baseUrl, config.modelId)) {
        this.appendStartupLog(`Using existing local model backend at ${config.baseUrl}`);
        return config;
      }
      if (!this.ownedModelProcess) {
        throw new Error(
          `A different local model backend is already running on port ${config.port}. Stop it first or choose the running model.`,
        );
      }

      this.appendStartupLog(`Restarting local model backend with ${config.modelId}...`);
      await this.shutdownOwnedModelServer();
    }

    if (this.ownedModelProcess) {
      const ready = await waitForHealthyEndpoint(healthUrl, LOCAL_MODEL_START_TIMEOUT_MS)
        && await isLocalModelBackendServing(config.baseUrl, config.modelId);
      if (ready) {
        this.appendStartupLog(`Local model backend ready at ${config.baseUrl}`);
        return config;
      }
    }

    if (!(await pathExists(config.runScriptPath))) {
      throw new Error(`Glue desktop could not find claude-code-local at ${config.runScriptPath}. Run the Glue installer first.`);
    }

    this.appendStartupLog(`Starting local model backend (${config.modelId})...`);
    this.appendStartupLog(`$ ${config.runScriptPath} --server --model ${config.modelId} --port ${config.port}`);

    const child = spawn(config.runScriptPath, ['--server', '--model', config.modelId, '--port', String(config.port)], {
      cwd: path.dirname(config.runScriptPath),
      detached: true,
      env: {
        ...process.env,
        PATH: getDesktopPath(),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.ownedModelProcess = child;
    this.attachOwnedModelProcessLogging(child, config);

    const ready = await waitForHealthyEndpoint(healthUrl, LOCAL_MODEL_START_TIMEOUT_MS);
    if (!ready) {
      const recentLogs = this.getStartupLogs().slice(-20).join('\n');
      await this.shutdownOwnedModelServer();
      throw new Error([
        `Local model backend did not become ready at ${config.baseUrl}.`,
        recentLogs ? `Recent startup output:\n${recentLogs}` : 'No startup output was captured.',
      ].join('\n\n'));
    }

    this.appendStartupLog(`Local model backend ready at ${config.baseUrl}`);
    return config;
  }

  hasOwnedServer() {
    return Boolean(this.ownedServerProcess || this.ownedModelProcess);
  }

  detachOwnedServer() {
    if (this.ownedServerProcess) {
      this.ownedServerProcess.unref();
      this.ownedServerProcess = null;
    }
    if (this.ownedModelProcess) {
      this.ownedModelProcess.unref();
      this.ownedModelProcess = null;
    }
  }

  async shutdownOwnedModelServer() {
    if (!this.ownedModelProcess) return;

    const child = this.ownedModelProcess;
    this.ownedModelProcess = null;
    child.kill('SIGTERM');

    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 3000);
      child.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  async shutdownOwnedServer() {
    if (this.ownedServerProcess) {
      const child = this.ownedServerProcess;
      this.ownedServerProcess = null;
      child.kill('SIGTERM');

      await new Promise((resolve) => {
        const timeout = setTimeout(resolve, 3000);
        child.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    await this.shutdownOwnedModelServer();
  }
}

export {
  buildLocalModelEnvironment,
  DEFAULT_PORT,
  getLocalModelOptions,
  HOST,
  isReusableCloudCliServer,
  renderDotEnvFile,
  resolveLocalModelConfig,
};
