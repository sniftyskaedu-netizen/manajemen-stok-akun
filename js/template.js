/**
 * Template Engine for AccExpress WhatsApp Messages
 */
export const TemplateEngine = {
  /**
   * Format Date to Compact Numeric format with time: "23/08/2026 22:36"
   */
  formatDateIndo(dateStrOrObj) {
    if (!dateStrOrObj) return '-';
    const date = new Date(dateStrOrObj);
    if (isNaN(date.getTime())) return '-';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  },

  /**
   * Calculate Expiration Date based on sentDate, duration, and durationUnit
   */
  calculateExpirationDate(sentDate, duration, durationUnit) {
    const d = new Date(sentDate);
    const num = parseInt(duration, 10) || 1;

    switch ((durationUnit || 'Hari').toLowerCase()) {
      case 'hari':
      case 'day':
      case 'days':
        d.setDate(d.getDate() + num);
        break;
      case 'minggu':
      case 'week':
      case 'weeks':
        d.setDate(d.getDate() + (num * 7));
        break;
      case 'bulan':
      case 'month':
      case 'months':
        d.setMonth(d.getMonth() + num);
        break;
      default:
        d.setDate(d.getDate() + num);
    }
    return d.toISOString();
  },

  /**
   * Compile dynamic template string with data values
   */
  compile(templateText, data = {}) {
    if (!templateText) return '';

    let compiled = templateText;
    const sentDateStr = this.formatDateIndo(data.sent_date || new Date());
    const expDateStr = this.formatDateIndo(data.expires_date);
    const notesStr = data.notes || data.additional_info || data.catatan || '';
    const rawUsername = data.username || data.email || '';
    const rawLink = data.link || data.access_link || '';
    const accessType = (data.access_type || '').toUpperCase();
    const isLinkProduct = accessType === 'LINK' || Boolean(rawLink) || rawUsername.startsWith('http://') || rawUsername.startsWith('https://');

    const actualLink = rawLink || (isLinkProduct ? rawUsername : '');
    const displayUsernameOrLink = isLinkProduct ? (actualLink || rawUsername) : rawUsername;

    const replacements = {
      '{{product}}': data.product || '',
      '{{email/link}}': displayUsernameOrLink,
      '{{email_link}}': displayUsernameOrLink,
      '{{username}}': displayUsernameOrLink,
      '{{password}}': isLinkProduct ? '-' : (data.password || '-'),
      '{{link}}': displayUsernameOrLink,
      '{{link_akses}}': displayUsernameOrLink,
      '{{url_akses}}': displayUsernameOrLink,
      '{{duration}}': data.duration || '',
      '{{duration_unit}}': data.duration_unit || 'Hari',
      '{{customer_whatsapp}}': data.customer_whatsapp || '',
      '{{notes}}': notesStr,
      '{{catatan}}': notesStr,
      '{{catatan_info}}': notesStr,
      '{{additional_info}}': notesStr,
      '{{sent_date}}': sentDateStr,
      '{{expires_date}}': expDateStr
    };

    Object.keys(replacements).forEach(tag => {
      const regex = new RegExp(tag.replace(/([.*+?^${}()|[\]\\])/g, '\\$1'), 'g');
      compiled = compiled.replace(regex, replacements[tag]);
    });

    return compiled;
  }
};
