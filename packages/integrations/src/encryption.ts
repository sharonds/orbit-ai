import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

export interface EncryptionProvider {
  encrypt(plaintext: string): Promise<string>
  decrypt(ciphertext: string): Promise<string>
}

/**
 * AES-256-GCM encryption provider.
 * Key must be a 64-character hex string (32 bytes = 256 bits).
 * Ciphertext format: hex(iv) + ':' + hex(ciphertext) + ':' + hex(authTag)
 */
export class AesGcmEncryptionProvider implements EncryptionProvider {
  private readonly key: Buffer

  constructor(keyHex?: string) {
    const k = keyHex ?? process.env['ORBIT_CREDENTIAL_KEY']
    if (!k || !/^[0-9a-fA-F]{64}$/.test(k)) {
      throw new Error(
        'ORBIT_CREDENTIAL_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
      )
    }
    this.key = Buffer.from(k, 'hex')
  }

  async encrypt(plaintext: string): Promise<string> {
    const iv = randomBytes(12) // 96-bit IV for GCM
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    return [iv.toString('hex'), encrypted.toString('hex'), authTag.toString('hex')].join(':')
  }

  async decrypt(ciphertext: string): Promise<string> {
    const parts = ciphertext.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format: expected iv:data:authTag')
    }
    const [ivHex, dataHex, authTagHex] = parts as [string, string, string]
    const iv = Buffer.from(ivHex, 'hex')
    const data = Buffer.from(dataHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
  }
}

/**
 * Plaintext passthrough — for testing only. Never use in production.
 */
export class NoopEncryptionProvider implements EncryptionProvider {
  async encrypt(plaintext: string): Promise<string> {
    return plaintext
  }
  async decrypt(ciphertext: string): Promise<string> {
    return ciphertext
  }
}
