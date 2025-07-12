/**
 * Validation utilities for input sanitization, format validation, and data cleaning
 */

import { generateId } from './crypto';

// Email validation
export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

// URL validation
export function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

// Phone number validation (international format)
export function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/[\s()-]/g, ''));
}

// Username validation
export function validateUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username);
}

// Password strength validation
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;
  
  // Length check
  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
  } else if (password.length >= 12) {
    score += 2;
  } else {
    score += 1;
  }
  
  // Character variety checks
  if (!/[a-z]/.test(password)) {
    feedback.push('Password must contain at least one lowercase letter');
  } else {
    score += 1;
  }
  
  if (!/[A-Z]/.test(password)) {
    feedback.push('Password must contain at least one uppercase letter');
  } else {
    score += 1;
  }
  
  if (!/\d/.test(password)) {
    feedback.push('Password must contain at least one number');
  } else {
    score += 1;
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    feedback.push('Password must contain at least one special character');
  } else {
    score += 1;
  }
  
  // Common patterns check
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /admin/i,
    /letmein/i,
    /welcome/i
  ];
  
  if (commonPatterns.some(pattern => pattern.test(password))) {
    feedback.push('Password contains common patterns that should be avoided');
    score -= 2;
  }
  
  // Sequential characters check
  if (/(..).*\1/.test(password)) {
    feedback.push('Password should not contain repeated sequences');
    score -= 1;
  }
  
  const isValid = feedback.length === 0 && score >= 4;
  
  return {
    isValid,
    score: Math.max(0, Math.min(5, score)),
    feedback
  };
}

// Sanitize input to prevent XSS
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/[<>"'&]/g, (match) => {
      const entities: { [key: string]: string } = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[match] || match;
    })
    .trim();
}

// Sanitize HTML content
export function sanitizeHtml(html: string): string {
  // Basic HTML sanitization - remove script tags and dangerous attributes
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:/gi, '');
}

// Validate and sanitize JSON
export function validateAndSanitizeJson(jsonString: string): any {
  try {
    const parsed = JSON.parse(jsonString);
    return sanitizeObject(parsed);
  } catch (error) {
    throw new Error('Invalid JSON format');
  }
}

// Recursively sanitize object properties
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeInput(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

// Validate file upload
export function validateFileUpload(file: {
  name: string;
  size: number;
  type: string;
}, options: {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
} = {}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [],
    allowedExtensions = []
  } = options;
  
  // Size validation
  if (file.size > maxSize) {
    errors.push(`File size exceeds maximum allowed size of ${formatFileSize(maxSize)}`);
  }
  
  // Type validation
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} is not allowed`);
  }
  
  // Extension validation
  if (allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      errors.push(`File extension is not allowed`);
    }
  }
  
  // Filename validation
  if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
    errors.push('Filename contains invalid characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Validate cryptocurrency address
export function validateCryptoAddress(address: string, currency: string): boolean {
  const patterns: { [key: string]: RegExp } = {
    BTC: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/,
    ETH: /^0x[a-fA-F0-9]{40}$/,
    USDT: /^0x[a-fA-F0-9]{40}$|^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    USDC: /^0x[a-fA-F0-9]{40}$/,
    BNB: /^bnb[a-z0-9]{39}$|^0x[a-fA-F0-9]{40}$/
  };
  
  const pattern = patterns[currency.toUpperCase()];
  return pattern ? pattern.test(address) : false;
}

// Validate transaction hash
export function validateTransactionHash(hash: string, blockchain: string = 'ETH'): boolean {
  const patterns: { [key: string]: RegExp } = {
    ETH: /^0x[a-fA-F0-9]{64}$/,
    BTC: /^[a-fA-F0-9]{64}$/,
    BSC: /^0x[a-fA-F0-9]{64}$/,
    POLYGON: /^0x[a-fA-F0-9]{64}$/
  };
  
  const pattern = patterns[blockchain.toUpperCase()];
  return pattern ? pattern.test(hash) : false;
}

// Validate date format (YYYY-MM-DD)
export function validateDateFormat(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return false;
  }
  
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  
  return dateObj.getFullYear() === year &&
         dateObj.getMonth() === month - 1 &&
         dateObj.getDate() === day;
}

// Validate time format (HH:MM or HH:MM:SS)
export function validateTimeFormat(time: string): boolean {
  const timeRegex = /^([01]?\d|2[0-3]):([0-5]?\d)(?::([0-5]?\d))?$/;
  return timeRegex.test(time);
}

// Validate ISO 8601 datetime format
export function validateISODateTime(datetime: string): boolean {
  try {
    const date = new Date(datetime);
    return date.toISOString() === datetime;
  } catch {
    return false;
  }
}

// Validate color hex code
export function validateHexColor(color: string): boolean {
  const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return hexRegex.test(color);
}

// Validate IP address
export function validateIPAddress(ip: string): { isValid: boolean; version?: 4 | 6 } {
  // IPv4 validation
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(ip)) {
    return { isValid: true, version: 4 };
  }
  
  // IPv6 validation
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  if (ipv6Regex.test(ip)) {
    return { isValid: true, version: 6 };
  }
  
  return { isValid: false };
}

// Validate domain name
export function validateDomain(domain: string): boolean {
  const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(com|org|net|edu|gov|mil|int|arpa|[a-zA-Z]{2})$/i;
  return domainRegex.test(domain) && domain.length <= 253;
}

// Validate slug (URL-friendly string)
export function validateSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  return slugRegex.test(slug) && slug.length <= 100;
}

// Generate slug from text
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

// Validate credit card number (Luhn algorithm)
export function validateCreditCard(cardNumber: string): {
  isValid: boolean;
  type?: string;
} {
  const cleaned = cardNumber.replace(/\D/g, '');
  
  if (cleaned.length < 13 || cleaned.length > 19) {
    return { isValid: false };
  }
  
  // Luhn algorithm
  let sum = 0;
  let isEven = false;
  
  for (let i = cleaned.length - 1; i >= 0; i--) {
    let digit = parseInt(cleaned[i]);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  const isValid = sum % 10 === 0;
  
  if (!isValid) {
    return { isValid: false };
  }
  
  // Determine card type
  let type = 'Unknown';
  if (/^4/.test(cleaned)) {
    type = 'Visa';
  } else if (/^5[1-5]/.test(cleaned)) {
    type = 'MasterCard';
  } else if (/^3[47]/.test(cleaned)) {
    type = 'American Express';
  } else if (/^6(?:011|5)/.test(cleaned)) {
    type = 'Discover';
  }
  
  return { isValid: true, type };
}

// Validate social security number (US format)
export function validateSSN(ssn: string): boolean {
  const ssnRegex = /^(?!666|000|9\d{2})\d{3}-?(?!00)\d{2}-?(?!0{4})\d{4}$/;
  return ssnRegex.test(ssn.replace(/\D/g, ''));
}

// Validate postal code
export function validatePostalCode(postalCode: string, country: string = 'US'): boolean {
  const patterns: { [key: string]: RegExp } = {
    US: /^\d{5}(-\d{4})?$/,
    CA: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/,
    UK: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/,
    DE: /^\d{5}$/,
    FR: /^\d{5}$/,
    JP: /^\d{3}-\d{4}$/,
    CN: /^\d{6}$/
  };
  
  const pattern = patterns[country.toUpperCase()];
  return pattern ? pattern.test(postalCode) : true; // Default to true for unknown countries
}

// Normalize phone number
export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

// Format phone number for display
export function formatPhoneNumber(phone: string, country: string = 'US'): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (country === 'US' && cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  if (country === 'US' && cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone; // Return original if can't format
}

// Validate and format currency amount
export function validateCurrencyAmount(amount: string | number): {
  isValid: boolean;
  value?: number;
  formatted?: string;
} {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount) || numAmount < 0) {
    return { isValid: false };
  }
  
  // Check for reasonable precision (max 8 decimal places)
  const decimalPlaces = (numAmount.toString().split('.')[1] || '').length;
  if (decimalPlaces > 8) {
    return { isValid: false };
  }
  
  return {
    isValid: true,
    value: numAmount,
    formatted: numAmount.toFixed(2)
  };
}

// Generate unique filename
export function generateUniqueFilename(originalName: string): string {
  const extension = originalName.split('.').pop();
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = Date.now();
  const randomId = generateId().split('-')[0];
  
  return `${sanitizedBaseName}_${timestamp}_${randomId}.${extension}`;
}

// Validate pagination parameters
export function validatePagination(page?: string | number, limit?: string | number): {
  page: number;
  limit: number;
  offset: number;
} {
  const parsedPage = Math.max(1, parseInt(String(page || 1)));
  const parsedLimit = Math.min(100, Math.max(1, parseInt(String(limit || 20))));
  const offset = (parsedPage - 1) * parsedLimit;
  
  return {
    page: parsedPage,
    limit: parsedLimit,
    offset
  };
}

// Validate sort parameters
export function validateSort(sort?: string, allowedFields: string[] = []): {
  field: string;
  direction: 'ASC' | 'DESC';
} {
  if (!sort) {
    return { field: allowedFields[0] || 'id', direction: 'DESC' };
  }
  
  const [field, direction] = sort.split(':');
  const validField = allowedFields.includes(field) ? field : allowedFields[0] || 'id';
  const validDirection = direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  return {
    field: validField,
    direction: validDirection
  };
}

export { generateId };