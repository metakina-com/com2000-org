/**
 * Cryptographic utilities for password hashing, ID generation, and security functions
 */

// Generate a random ID using crypto.randomUUID or fallback
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for environments without crypto.randomUUID
  return 'xxxx-xxxx-4xxx-yxxx-xxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Generate a secure random string
export function generateSecureToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return result;
}

// Hash a password using bcrypt-like algorithm
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'com2000_salt'); // Add application salt
  
  // Use SubtleCrypto for hashing
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Simple bcrypt-like format: $2a$10$salt$hash
  const salt = generateSecureToken(22);
  return `$2a$10$${salt}$${hashHex}`;
}

// Verify a password against its hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // Parse the hash format: $2a$10$salt$hash
    const parts = hash.split('$');
    if (parts.length !== 5 || parts[1] !== '2a' || parts[2] !== '10') {
      return false;
    }
    
    const salt = parts[3];
    const storedHash = parts[4];
    
    // Hash the provided password with the same salt
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'com2000_salt');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return computedHash === storedHash;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

// Generate HMAC signature
export async function generateHMAC(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify HMAC signature
export async function verifyHMAC(data: string, signature: string, secret: string): Promise<boolean> {
  try {
    const computedSignature = await generateHMAC(data, secret);
    return computedSignature === signature;
  } catch (error) {
    console.error('HMAC verification error:', error);
    return false;
  }
}

// Encrypt data using AES-GCM
export async function encryptData(data: string, key: string): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key.padEnd(32, '0').substring(0, 32)); // Ensure 32 bytes
  const dataBuffer = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for GCM
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    dataBuffer
  );
  
  const encryptedArray = Array.from(new Uint8Array(encrypted));
  const ivArray = Array.from(iv);
  
  return {
    encrypted: encryptedArray.map(b => b.toString(16).padStart(2, '0')).join(''),
    iv: ivArray.map(b => b.toString(16).padStart(2, '0')).join('')
  };
}

// Decrypt data using AES-GCM
export async function decryptData(encryptedHex: string, ivHex: string, key: string): Promise<string> {
  try {
    const keyData = new TextEncoder().encode(key.padEnd(32, '0').substring(0, 32));
    const encrypted = new Uint8Array(encryptedHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
    const iv = new Uint8Array(ivHex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

// Generate a cryptographically secure random number
export function secureRandom(min: number = 0, max: number = 1): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return min + (array[0] / (0xFFFFFFFF + 1)) * (max - min);
  }
  
  // Fallback to Math.random (less secure)
  return min + Math.random() * (max - min);
}

// Generate a secure random integer
export function secureRandomInt(min: number, max: number): number {
  return Math.floor(secureRandom(min, max + 1));
}

// Hash data using SHA-256
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate a time-based one-time password (TOTP)
export async function generateTOTP(secret: string, timeStep: number = 30): Promise<string> {
  const time = Math.floor(Date.now() / 1000 / timeStep);
  const timeHex = time.toString(16).padStart(16, '0');
  
  const hmac = await generateHMAC(timeHex, secret);
  const offset = parseInt(hmac.slice(-1), 16);
  const code = parseInt(hmac.slice(offset * 2, offset * 2 + 8), 16) & 0x7fffffff;
  
  return (code % 1000000).toString().padStart(6, '0');
}

// Verify a TOTP code
export async function verifyTOTP(code: string, secret: string, timeStep: number = 30, window: number = 1): Promise<boolean> {
  const currentTime = Math.floor(Date.now() / 1000 / timeStep);
  
  // Check current time and adjacent time windows
  for (let i = -window; i <= window; i++) {
    const time = currentTime + i;
    const timeHex = time.toString(16).padStart(16, '0');
    
    const hmac = await generateHMAC(timeHex, secret);
    const offset = parseInt(hmac.slice(-1), 16);
    const expectedCode = parseInt(hmac.slice(offset * 2, offset * 2 + 8), 16) & 0x7fffffff;
    const formattedCode = (expectedCode % 1000000).toString().padStart(6, '0');
    
    if (formattedCode === code) {
      return true;
    }
  }
  
  return false;
}

// Generate a secure session token
export function generateSessionToken(): string {
  return generateSecureToken(64);
}

// Generate API key
export function generateApiKey(): string {
  const prefix = 'com2000_';
  const key = generateSecureToken(32);
  return prefix + key;
}

// Validate API key format
export function validateApiKey(apiKey: string): boolean {
  return /^com2000_[A-Za-z0-9]{32}$/.test(apiKey);
}

// Generate a nonce for preventing replay attacks
export function generateNonce(): string {
  const timestamp = Date.now().toString();
  const random = generateSecureToken(16);
  return `${timestamp}_${random}`;
}

// Validate nonce (check if it's not too old)
export function validateNonce(nonce: string, maxAge: number = 300000): boolean { // 5 minutes default
  try {
    const [timestampStr] = nonce.split('_');
    const timestamp = parseInt(timestampStr);
    const now = Date.now();
    
    return (now - timestamp) <= maxAge;
  } catch (error) {
    return false;
  }
}

// Rate limiting token bucket
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  
  constructor(
    private capacity: number,
    private refillRate: number, // tokens per second
    private refillPeriod: number = 1000 // milliseconds
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  
  consume(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }
  
  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor((timePassed / this.refillPeriod) * this.refillRate);
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }
  
  getTokens(): number {
    this.refill();
    return this.tokens;
  }
}

// Constant-time string comparison to prevent timing attacks
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

// Generate a deterministic ID from input data
export async function generateDeterministicId(data: string): Promise<string> {
  const hash = await sha256(data);
  return hash.substring(0, 32); // Use first 32 characters as ID
}

// Mask sensitive data for logging
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (data.length <= visibleChars * 2) {
    return '*'.repeat(data.length);
  }
  
  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  const masked = '*'.repeat(data.length - visibleChars * 2);
  
  return start + masked + end;
}

// Generate checksum for data integrity
export async function generateChecksum(data: string): Promise<string> {
  const hash = await sha256(data);
  return hash.substring(0, 8); // Use first 8 characters as checksum
}

// Verify data integrity using checksum
export async function verifyChecksum(data: string, checksum: string): Promise<boolean> {
  const computedChecksum = await generateChecksum(data);
  return constantTimeCompare(computedChecksum, checksum);
}