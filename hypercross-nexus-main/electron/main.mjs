import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { authSignin, authSignup, createAsset, getAssets, getDatabasePath } from './database.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rendererUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:3000';
const isDev = !app.isPackaged;

let mainWindow = null;

function getConfigSourcePath() {
  const userConfigPath = path.join(app.getPath('userData'), 'whiteLabelConfig.json');
  const bundledConfigPath = path.join(process.cwd(), 'config', 'whiteLabelConfig.json');
  return fs.existsSync(userConfigPath) ? userConfigPath : bundledConfigPath;
}

function readConfig() {
  const configPath = getConfigSourcePath();
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function writeConfig(config) {
  const userConfigPath = path.join(app.getPath('userData'), 'whiteLabelConfig.json');
  fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });
  fs.writeFileSync(userConfigPath, JSON.stringify(config, null, 2));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (isDev) {
    await mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await mainWindow.loadFile(path.join(process.cwd(), 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('db-get-assets', async (_event, orgId) => {
  return getAssets(orgId);
});

ipcMain.handle('auth-signup', async (_event, payload) => {
  return authSignup(payload || {});
});

ipcMain.handle('auth-signin', async (_event, payload) => {
  return authSignin(payload || {});
});

ipcMain.handle('db-create-asset', async (_event, data) => {
  return createAsset(data);
});

ipcMain.handle('db-get-info', async () => ({
  path: getDatabasePath(),
}));

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  return result.canceled ? null : result.filePaths[0] ?? null;
});

ipcMain.handle('get-config', async () => readConfig());

ipcMain.handle('update-config', async (_event, config) => {
  writeConfig(config);
});

ipcMain.handle('log', async (_event, message, data) => {
  console.log('[renderer]', message, data ?? '');
});

app.whenReady().then(() => {
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [{ role: 'quit' }],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});