import { apiFetch } from './apiFetch';

export type UploadResponse = {
  url: string;
};

export async function uploadArchivo(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<UploadResponse>('/api/uploads', {
    method: 'POST',
    body: formData,
  });
}
