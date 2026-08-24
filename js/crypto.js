/**
 * AccExpress Security & Encryption Utility
 */
export const CryptoUtil = {
  _secretKey: 'AccExpress-SellerHub-SecureKey-2026',

  async hashPassword(password) {
    if (!password) return '';
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return btoa(password);
    }
  },

  async encrypt(text) {
    if (!text) return '';
    try {
      return 'ENC:' + btoa(encodeURIComponent(text));
    } catch {
      return text;
    }
  },

  async decrypt(cipherText) {
    if (!cipherText) return '';
    try {
      if (cipherText.startsWith('ENC:')) {
        return decodeURIComponent(atob(cipherText.replace('ENC:', '')));
      }
      return cipherText;
    } catch {
      return cipherText;
    }
  }
};
