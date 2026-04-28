import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getSecretKey(): Buffer {
  const baseSecret = process.env.SMTP_PASSWORD_ENCRYPTION_KEY
    || process.env.JWT_SECRET
    || process.env.JWT_SECRET_KEY;

  if (!baseSecret) {
    throw new Error('Falta SMTP_PASSWORD_ENCRYPTION_KEY para cifrar secretos SMTP');
  }

  return crypto.createHash('sha256').update(baseSecret).digest();
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(value: string): string {
  const [ivHex, authTagHex, encryptedHex] = value.split(':');

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Formato de secreto cifrado inválido');
  }

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getSecretKey(),
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}