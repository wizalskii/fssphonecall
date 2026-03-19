/// <reference types="vite/client" />

export interface ElectronAPI {
  getSettings: () => Promise<{ pttKey: string; audioInput: string; audioOutput: string }>;
  setSetting: (key: string, value: unknown) => Promise<void>;
  getVersion: () => Promise<string>;
  checkForUpdates: () => Promise<string | null>;
  onUpdateAvailable: (callback: (version: string) => void) => () => void;
  onUpdateDownloaded: (callback: (version: string) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
