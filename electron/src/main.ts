import { app, BrowserWindow, globalShortcut, ipcMain, shell } from 'electron';
import * as path from 'path';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';

interface StoreSchema {
  pttKey: string;
  audioInput: string;
  audioOutput: string;
  windowBounds: { width: number; height: number };
}

const store = new Store<StoreSchema>({
  defaults: {
    pttKey: 'num0',
    audioInput: '',
    audioOutput: '',
    windowBounds: { width: 1024, height: 768 },
  },
});

let mainWindow: BrowserWindow | null = null;
let pttRegistered = false;

function createWindow() {
  const bounds = store.get('windowBounds') as { width: number; height: number };

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 480,
    minHeight: 600,
    title: 'vFSS Phone',
    backgroundColor: '#0d0f12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In production, load the built client files
  // In dev, load the Vite dev server
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const clientPath = path.join(process.resourcesPath, 'client', 'index.html');
    mainWindow.loadFile(clientPath);
  }

  // Save window size on resize
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize();
      store.set('windowBounds', { width, height });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open external links in browser (only allow http/https)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch {
      // Invalid URL — do not open
    }
    return { action: 'deny' };
  });

  registerPTT();
}

function registerPTT() {
  if (pttRegistered) {
    globalShortcut.unregisterAll();
    pttRegistered = false;
  }

  const key = store.get('pttKey') as string;
  const accelerator = keyToAccelerator(key);
  if (!accelerator) return;

  // Electron globalShortcut doesn't support keyup, so we use a polling approach
  // via the iohook-like pattern. For now, use a workaround:
  // Register the key and send press event. Use a timer to detect release.
  // Better approach: use uiohook-napi in a future iteration.

  // For now, send PTT state via IPC from the renderer's keydown/keyup
  // Global PTT will be enhanced with native key hooks in a future update
  pttRegistered = true;
}

function keyToAccelerator(key: string): string | null {
  const map: Record<string, string> = {
    num0: 'num0',
    num1: 'num1',
    num2: 'num2',
    F13: 'F13',
    F14: 'F14',
    F15: 'F15',
  };
  return map[key] || null;
}

// IPC handlers
ipcMain.handle('get-settings', () => {
  return {
    pttKey: store.get('pttKey'),
    audioInput: store.get('audioInput'),
    audioOutput: store.get('audioOutput'),
  };
});

ipcMain.handle('set-setting', (_event, key: string, value: unknown) => {
  const allowedKeys = ['pttKey', 'audioInput', 'audioOutput'];
  if (!allowedKeys.includes(key)) return;
  store.set(key, value);
  if (key === 'pttKey') registerPTT();
});

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return result?.updateInfo?.version || null;
  } catch {
    return null;
  }
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  // Check for updates silently
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.checkForUpdates().catch(() => {});

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Auto-updater events
autoUpdater.on('update-available', (info) => {
  mainWindow?.webContents.send('update-available', info.version);
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('update-downloaded', info.version);
});
