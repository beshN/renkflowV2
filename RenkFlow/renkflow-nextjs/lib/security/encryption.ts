/**
 * Encryption Utilities for Data Protection
 * - AES-256-GCM for data at rest
 * - Field-level encryption for sensitive data
 * - Key rotation support
 */

// ============================================
// Types
// ============================================

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  tag: string;
  keyId: string;
  version: number;
}

export interface EncryptionKey {
  id: string;
  key: CryptoKey;
  createdAt: number;
  expiresAt?: number;
  status: 'active' | 'rotated' | 'expired';
}

interface KeyMetadata {
  id: string;
  algorithm: string;
  createdAt: number;
  expiresAt?: number;
  status: 'active' | 'rotated' | 'expired';
}

// ============================================
// Encryption Manager
// ============================================

class EncryptionManager {
  private static instance: EncryptionManager;
  private keys: Map<string, EncryptionKey> = new Map();
  private activeKeyId: string | null = null;
  private readonly ALGORITHM = 'AES-GCM';
  private readonly KEY_LENGTH = 256;
  private readonly IV_LENGTH = 12;
  private readonly VERSION = 1;

  private constructor() {}

  static getInstance(): EncryptionManager {
    if (!EncryptionManager.instance) {
      EncryptionManager.instance = new EncryptionManager();
    }
    return EncryptionManager.instance;
  }

  /**
   * Initialize with a master key (from environment variable)
   */
  async initialize(masterKeyBase64?: string): Promise<void> {
    if (typeof window !== 'undefined') {
      console.warn('[Encryption] Client-side encryption not recommended');
      return;
    }

    // Generate or import master key
    let masterKey: CryptoKey;

    if (masterKeyBase64) {
      const keyBuffer = Buffer.from(masterKeyBase64, 'base64');
      masterKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: this.ALGORITHM },
        false,
        ['encrypt', 'decrypt']
      );
    } else {
      masterKey = await this.generateKey();
    }

    const keyId = this.generateKeyId();
    this.keys.set(keyId, {
      id: keyId,
      key: masterKey,
      createdAt: Date.now(),
      status: 'active',
    });
    this.activeKeyId = keyId;
  }

  /**
   * Generate a new encryption key
   */
  async generateKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data
   */
  async encrypt(data: string | object): Promise<EncryptedData> {
    if (!this.activeKeyId) {
      throw new Error('Encryption not initialized');
    }

    const keyInfo = this.keys.get(this.activeKeyId);
    if (!keyInfo) {
      throw new Error('Active key not found');
    }

    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
    const encoder = new TextEncoder();
    const plaintextBuffer = encoder.encode(plaintext);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

    // Encrypt
    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv },
      keyInfo.key,
      plaintextBuffer
    );

    // Extract auth tag (last 16 bytes of ciphertext in GCM mode)
    const ciphertextArray = new Uint8Array(ciphertextBuffer);
    const tag = ciphertextArray.slice(-16);
    const ciphertext = ciphertextArray.slice(0, -16);

    return {
      ciphertext: this.bufferToBase64(ciphertext),
      iv: this.bufferToBase64(iv),
      tag: this.bufferToBase64(tag),
      keyId: this.activeKeyId,
      version: this.VERSION,
    };
  }

  /**
   * Decrypt data
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    const keyInfo = this.keys.get(encryptedData.keyId);
    if (!keyInfo) {
      throw new Error(`Key ${encryptedData.keyId} not found`);
    }

    const ciphertext = this.base64ToBuffer(encryptedData.ciphertext);
    const iv = this.base64ToBuffer(encryptedData.iv);
    const tag = this.base64ToBuffer(encryptedData.tag);

    // Reconstruct full ciphertext (including tag for GCM)
    const fullCiphertext = new Uint8Array(ciphertext.length + tag.length);
    fullCiphertext.set(ciphertext);
    fullCiphertext.set(tag, ciphertext.length);

    const ivBytes = new Uint8Array(iv);
    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: this.ALGORITHM, iv: ivBytes },
      keyInfo.key,
      fullCiphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(plaintextBuffer);
  }

  /**
   * Decrypt to object
   */
  async decryptToObject<T>(encryptedData: EncryptedData): Promise<T> {
    const plaintext = await this.decrypt(encryptedData);
    return JSON.parse(plaintext);
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(): Promise<string> {
    // Mark current key as rotated
    if (this.activeKeyId) {
      const currentKey = this.keys.get(this.activeKeyId);
      if (currentKey) {
        currentKey.status = 'rotated';
      }
    }

    // Generate new key
    const newKey = await this.generateKey();
    const newKeyId = this.generateKeyId();

    this.keys.set(newKeyId, {
      id: newKeyId,
      key: newKey,
      createdAt: Date.now(),
      status: 'active',
    });

    this.activeKeyId = newKeyId;
    return newKeyId;
  }

  /**
   * Re-encrypt data with new key
   */
  async reencrypt(encryptedData: EncryptedData): Promise<EncryptedData> {
    // Decrypt with old key
    const plaintext = await this.decrypt(encryptedData);
    
    // Encrypt with new key
    return this.encrypt(plaintext);
  }

  /**
   * Get key metadata (without exposing the actual key)
   */
  getKeyMetadata(keyId: string): KeyMetadata | null {
    const keyInfo = this.keys.get(keyId);
    if (!keyInfo) return null;

    return {
      id: keyInfo.id,
      algorithm: `${this.ALGORITHM}-${this.KEY_LENGTH}`,
      createdAt: keyInfo.createdAt,
      expiresAt: keyInfo.expiresAt,
      status: keyInfo.status,
    };
  }

  /**
   * Get all key metadata
   */
  getAllKeyMetadata(): KeyMetadata[] {
    return Array.from(this.keys.values()).map((keyInfo) => ({
      id: keyInfo.id,
      algorithm: `${this.ALGORITHM}-${this.KEY_LENGTH}`,
      createdAt: keyInfo.createdAt,
      expiresAt: keyInfo.expiresAt,
      status: keyInfo.status,
    }));
  }

  /**
   * Check if encryption is initialized
   */
  isInitialized(): boolean {
    return this.activeKeyId !== null;
  }

  // ============================================
  // Utility Methods
  // ============================================

  private generateKeyId(): string {
    return `key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private bufferToBase64(buffer: Uint8Array): string {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(buffer).toString('base64');
    }
    // Browser fallback
    return btoa(String.fromCharCode(...buffer));
  }

  private base64ToBuffer(base64: string): Uint8Array {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }
    // Browser fallback
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

export const encryption = EncryptionManager.getInstance();
export { EncryptionManager };

// ============================================
// Field-Level Encryption Helpers
// ============================================

export interface EncryptedField<T> {
  __encrypted: true;
  data: EncryptedData;
  fieldType: string;
}

/**
 * Create an encrypted field
 */
export async function encryptField<T>(value: T, fieldType: string): Promise<EncryptedField<T>> {
  const encryptedData = await encryption.encrypt(value as string | object);
  return {
    __encrypted: true,
    data: encryptedData,
    fieldType,
  };
}

/**
 * Decrypt an encrypted field
 */
export async function decryptField<T>(field: EncryptedField<T>): Promise<T> {
  if (!field.__encrypted) {
    throw new Error('Not an encrypted field');
  }

  const decrypted = await encryption.decrypt(field.data);
  
  // Try to parse as JSON, otherwise return as string
  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted as T;
  }
}

/**
 * Check if a value is an encrypted field
 */
export function isEncryptedField(value: unknown): value is EncryptedField<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__encrypted' in value &&
    (value as any).__encrypted === true
  );
}

// ============================================
// Sensitive Data Patterns
// ============================================

export const SENSITIVE_FIELDS = [
  'password',
  'secret',
  'token',
  'apiKey',
  'api_key',
  'creditCard',
  'credit_card',
  'ssn',
  'socialSecurityNumber',
  'bankAccount',
  'bank_account',
  'privateKey',
  'private_key',
];

/**
 * Check if a field name suggests sensitive data
 */
export function isSensitiveField(fieldName: string): boolean {
  const lowerName = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(
    (pattern) =>
      lowerName.includes(pattern.toLowerCase()) ||
      lowerName === pattern.toLowerCase()
  );
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveField(key)) {
      masked[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

// ============================================
// Hashing Utilities
// ============================================

/**
 * Hash a string using SHA-256
 */
export async function hash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash with salt
 */
export async function hashWithSalt(data: string, salt: string): Promise<string> {
  return hash(salt + data);
}

/**
 * Generate a random salt
 */
export function generateSalt(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, length);
}
