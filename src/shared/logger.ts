/**
 * Logger initialization and configuration
 */

import { ExtensionSettings } from './types';
import { setLoggerConfig, getLoggerConfig, getStoredLogs, clearStoredLogs } from './utils';

/**
 * Initialize logger with settings
 */
export function initializeLogger(settings: ExtensionSettings): void {
  setLoggerConfig({
    level: settings.debugMode ? 'debug' : settings.logLevel,
    enableConsole: true,
    enableStorage: settings.debugMode,
    maxStorageEntries: 1000,
  });
}

/**
 * Get debug information for troubleshooting
 */
export function getDebugInfo(): any {
  const config = getLoggerConfig();
  const recentLogs = getStoredLogs('error', 10);
  
  return {
    loggerConfig: config,
    recentErrors: recentLogs,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: typeof window !== 'undefined' ? window.location.href : 'service-worker',
  };
}

/**
 * Export debug logs for support
 */
export function exportDebugLogs(): string {
  const logs = getStoredLogs();
  const debugInfo = getDebugInfo();
  
  return JSON.stringify({
    debugInfo,
    logs,
    exportTime: new Date().toISOString(),
  }, null, 2);
}

/**
 * Clear debug logs
 */
export function clearDebugLogs(): void {
  clearStoredLogs();
}

/**
 * Log system information for debugging
 */
export function logSystemInfo(): void {
  const info = {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    url: typeof window !== 'undefined' ? window.location.href : 'service-worker',
    timestamp: Date.now(),
  };
  
  console.log('[Madrak] System Info:', info);
}
