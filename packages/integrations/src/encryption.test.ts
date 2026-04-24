import { describe, it, expect } from 'vitest'
import { AesGcmEncryptionProvider, NoopEncryptionProvider, OrbitEncryptionConfigError } from './encryption.js'

const VALID_KEY = 'a'.repeat(64) // 64 hex chars = 32 bytes

describe('AesGcmEncryptionProvider', () => {
  it('encrypts and decrypts correctly (round-trip)', async () => {
    const provider = new AesGcmEncryptionProvider(VALID_KEY)
    const plaintext = 'ya29.supersecret-token-value'
    const ciphertext = await provider.encrypt(plaintext)
    expect(ciphertext).not.toBe(plaintext)
    const decrypted = await provider.decrypt(ciphertext)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext each call (random IV)', async () => {
    const provider = new AesGcmEncryptionProvider(VALID_KEY)
    const plaintext = 'same-input'
    const ct1 = await provider.encrypt(plaintext)
    const ct2 = await provider.encrypt(plaintext)
    expect(ct1).not.toBe(ct2)
  })

  it('ciphertext has iv:data:authTag format (3 colon-separated parts)', async () => {
    const provider = new AesGcmEncryptionProvider(VALID_KEY)
    const ciphertext = await provider.encrypt('test')
    const parts = ciphertext.split(':')
    expect(parts).toHaveLength(3)
    // iv is 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24)
    // authTag is 16 bytes = 32 hex chars
    expect(parts[2]).toHaveLength(32)
  })

  it('throws OrbitEncryptionConfigError with MISSING_CREDENTIAL_KEY on missing key', () => {
    const originalEnv = process.env['ORBIT_CREDENTIAL_KEY']
    delete process.env['ORBIT_CREDENTIAL_KEY']
    try {
      let thrown: unknown
      try {
        new AesGcmEncryptionProvider()
      } catch (err) {
        thrown = err
      }
      expect(thrown).toBeDefined()
      expect((thrown as { name?: unknown }).name).toBe('OrbitEncryptionConfigError')
      expect((thrown as OrbitEncryptionConfigError).code).toBe('MISSING_CREDENTIAL_KEY')
    } finally {
      if (originalEnv !== undefined) {
        process.env['ORBIT_CREDENTIAL_KEY'] = originalEnv
      }
    }
  })

  it('throws OrbitEncryptionConfigError with INVALID_CREDENTIAL_KEY on malformed key', () => {
    let thrown: unknown
    try {
      new AesGcmEncryptionProvider('abc123')
    } catch (err) {
      thrown = err
    }
    expect(thrown).toBeDefined()
    expect((thrown as { name?: unknown }).name).toBe('OrbitEncryptionConfigError')
    expect((thrown as OrbitEncryptionConfigError).code).toBe('INVALID_CREDENTIAL_KEY')
  })

  it('throws on key that is too short', () => {
    expect(() => new AesGcmEncryptionProvider('abc123')).toThrow('ORBIT_CREDENTIAL_KEY')
  })

  it('throws on key with non-hex characters', () => {
    expect(() => new AesGcmEncryptionProvider('z'.repeat(64))).toThrow('ORBIT_CREDENTIAL_KEY')
  })

  it('throws on key that is too long', () => {
    expect(() => new AesGcmEncryptionProvider('a'.repeat(66))).toThrow('ORBIT_CREDENTIAL_KEY')
  })

  it('reads key from ORBIT_CREDENTIAL_KEY env var', async () => {
    const originalEnv = process.env['ORBIT_CREDENTIAL_KEY']
    process.env['ORBIT_CREDENTIAL_KEY'] = VALID_KEY
    try {
      const provider = new AesGcmEncryptionProvider()
      const ct = await provider.encrypt('hello')
      expect(await provider.decrypt(ct)).toBe('hello')
    } finally {
      if (originalEnv !== undefined) {
        process.env['ORBIT_CREDENTIAL_KEY'] = originalEnv
      } else {
        delete process.env['ORBIT_CREDENTIAL_KEY']
      }
    }
  })

  it('throws on tampered ciphertext (auth tag mismatch)', async () => {
    const provider = new AesGcmEncryptionProvider(VALID_KEY)
    const ciphertext = await provider.encrypt('sensitive-data')
    const parts = ciphertext.split(':')
    // Flip first byte of data
    const tamperedData = 'ff' + parts[1]!.slice(2)
    const tampered = [parts[0], tamperedData, parts[2]].join(':')
    await expect(provider.decrypt(tampered)).rejects.toThrow()
  })

  it('throws on ciphertext with wrong number of parts', async () => {
    const provider = new AesGcmEncryptionProvider(VALID_KEY)
    await expect(provider.decrypt('only:two')).rejects.toThrow('Invalid ciphertext format')
    await expect(provider.decrypt('no-colon-at-all')).rejects.toThrow('Invalid ciphertext format')
  })
})

describe('NoopEncryptionProvider', () => {
  it('is a passthrough for encrypt', async () => {
    const provider = new NoopEncryptionProvider()
    expect(await provider.encrypt('hello')).toBe('hello')
  })

  it('is a passthrough for decrypt', async () => {
    const provider = new NoopEncryptionProvider()
    expect(await provider.decrypt('hello')).toBe('hello')
  })

  it('round-trips correctly', async () => {
    const provider = new NoopEncryptionProvider()
    const plaintext = 'test-token-123'
    expect(await provider.decrypt(await provider.encrypt(plaintext))).toBe(plaintext)
  })
})
