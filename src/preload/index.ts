import { contextBridge } from 'electron';
import { localTTSApi } from './api';

try {
  contextBridge.exposeInMainWorld('localTTS', localTTSApi);
} catch (error) {
  console.error('Failed to expose localTTS preload API to main world:', error);
}
