const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
const IMAGEKIT_PUBLIC_KEY = import.meta.env.VITE_IMAGEKIT_PUBLIC_KEY as string;
const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

export async function uploadImageToImageKit(file: File, folder = 'general'): Promise<string> {
  // Fetch auth signature from FastAPI backend (never exposes private key to frontend)
  const authRes = await fetch(`${API_BASE}/imagekit-auth`);
  if (!authRes.ok) {
    throw new Error(`Failed to get ImageKit auth: ${authRes.status} ${authRes.statusText}`);
  }
  const { token, expire, signature } = await authRes.json();

  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileName', `${Date.now()}_${file.name}`);
  formData.append('folder', folder);
  formData.append('publicKey', IMAGEKIT_PUBLIC_KEY);
  formData.append('token', token);
  formData.append('expire', String(expire));
  formData.append('signature', signature);

  const uploadRes = await fetch(IMAGEKIT_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`ImageKit upload failed: ${errText}`);
  }

  const data = await uploadRes.json();
  return data.url as string;
}
