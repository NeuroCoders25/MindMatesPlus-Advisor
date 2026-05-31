const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export interface EncryptedMessage {
  ciphertext?: string;
  iv?: string;
  v?: number;
  plaintext?: string;
}

export async function encryptText(
  text: string,
): Promise<EncryptedMessage | string> {
  try {
    const res = await fetch(`${BASE_URL}/crypto/encrypt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return text;
    return (await res.json()) as EncryptedMessage;
  } catch (e) {
    console.warn('encryptText failed:', e);
    return text;
  }
}

export async function decryptBatch(
  items: Array<EncryptedMessage | string>,
): Promise<string[]> {
  if (items.length === 0) return [];
  try {
    const res = await fetch(`${BASE_URL}/crypto/decrypt-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!res.ok)
      return items.map((i) =>
        typeof i === 'string' ? i : (i.plaintext ?? '[encrypted]'),
      );
    const data = (await res.json()) as { plaintext: string[] };
    return data.plaintext;
  } catch (e) {
    console.warn('decryptBatch failed:', e);
    return items.map((i) =>
      typeof i === 'string' ? i : (i.plaintext ?? '[encrypted]'),
    );
  }
}

export function isEncrypted(val: unknown): val is EncryptedMessage {
  return (
    val !== null &&
    typeof val === 'object' &&
    'ciphertext' in (val as object) &&
    'iv' in (val as object)
  );
}

export async function decryptOne(
  val: EncryptedMessage | string,
): Promise<string> {
  const [plain] = await decryptBatch([val]);
  return plain ?? '';
}

// Safety net: always returns a string — prevents encrypted objects reaching JSX.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeText(val: any): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object') {
    if (typeof val.plaintext === 'string') return val.plaintext;
    if (val.ciphertext) return '[decrypting…]';
  }
  return '';
}
