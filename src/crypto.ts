import { fromBase64, toBase64 } from "./util";

async function deriveKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function arrayBufferFromBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function encryptSecret(secret: string, encryptionSecret: string): Promise<{ encrypted: string; iv: string }> {
  const key = await deriveKey(encryptionSecret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(secret));
  return {
    encrypted: toBase64(new Uint8Array(cipher)),
    iv: toBase64(iv),
  };
}

export async function decryptSecret(encrypted: string, iv: string, encryptionSecret: string): Promise<string> {
  const key = await deriveKey(encryptionSecret);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: arrayBufferFromBytes(fromBase64(iv)) },
    key,
    arrayBufferFromBytes(fromBase64(encrypted)),
  );
  return new TextDecoder().decode(plain);
}
