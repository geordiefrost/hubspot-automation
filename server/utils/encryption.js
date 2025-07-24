const crypto = require('crypto');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.secretKey = this.getSecretKey();
  }

  getSecretKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    if (key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
    }
    return Buffer.from(key, 'utf8');
  }

  encrypt(text) {
    if (!text) return null;
    
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, this.secretKey);
      cipher.setAAD(Buffer.from('hubspot-automation', 'utf8'));
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  decrypt(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'object') {
      return null;
    }
    
    try {
      const { encrypted, iv, authTag } = encryptedData;
      
      const decipher = crypto.createDecipher(this.algorithm, this.secretKey);
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      decipher.setAAD(Buffer.from('hubspot-automation', 'utf8'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  hash(text) {
    if (!text) return null;
    return crypto.createHash('sha256').update(text).digest('hex');
  }

  compareHash(text, hash) {
    if (!text || !hash) return false;
    return this.hash(text) === hash;
  }

  generateSecureKey(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  generateSalt(length = 16) {
    return crypto.randomBytes(length).toString('hex');
  }

  hashWithSalt(text, salt) {
    if (!text || !salt) return null;
    return crypto.pbkdf2Sync(text, salt, 10000, 64, 'sha256').toString('hex');
  }

  verifyHashWithSalt(text, salt, hash) {
    if (!text || !salt || !hash) return false;
    const computedHash = this.hashWithSalt(text, salt);
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
  }
}

module.exports = new EncryptionService();