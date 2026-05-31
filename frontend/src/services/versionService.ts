import { apiFetch } from './apiFetch';

type VersionResponse = {
  version: string;
};

export async function fetchCurrentVersion(): Promise<string> {
  const response = await apiFetch<VersionResponse>('/api/version', {
    cache: 'no-store',
  });

  return response.version;
}