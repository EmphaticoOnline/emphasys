import React from 'react';
import { fetchCurrentVersion } from '../services/versionService';

const LAST_SEEN_VERSION_KEY = 'emphasys.update.lastSeenVersion';
const POLL_INTERVAL_MS = 5 * 60 * 1000;

function readStorageValue(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorageValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // No-op.
  }
}

function buildReloadUrl(version: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('__emphasys_version', version);
  url.searchParams.set('__emphasys_reload_at', String(Date.now()));
  return url.toString();
}

export function useVersionUpdateNotice() {
  const [version, setVersion] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  const checkForVersion = React.useCallback(async () => {
    try {
      const currentVersion = await fetchCurrentVersion();
      if (!currentVersion) {
        return;
      }

      setVersion(currentVersion);

      const lastSeenVersion = readStorageValue(LAST_SEEN_VERSION_KEY);
      setOpen(currentVersion !== lastSeenVersion);
    } catch (error) {
      console.error('No se pudo consultar la versión disponible:', error);
    }
  }, []);

  React.useEffect(() => {
    void checkForVersion();

    const intervalId = window.setInterval(() => {
      void checkForVersion();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [checkForVersion]);

  const dismiss = React.useCallback(() => {
    setOpen(false);
  }, []);

  const updateNow = React.useCallback(() => {
    if (!version) {
      return;
    }

    writeStorageValue(LAST_SEEN_VERSION_KEY, version);
    window.location.replace(buildReloadUrl(version));
  }, [version]);

  return {
    version,
    open,
    dismiss,
    updateNow,
  };
}