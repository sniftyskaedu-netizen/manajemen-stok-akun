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
   * Convert plain text letters & numbers to Mathematical Sans-Serif Bold Unicode characters
   * Works as native bold text across all platforms (Shopee, Tokopedia, Telegram, IG, FB, Notes, etc.)
   */
  toUnicodeBold(str) {
    if (!str) return '';
    return str.replace(/[A-Za-z0-9]/g, (char) => {
      const code = char.charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCodePoint(0x1D5D4 + (code - 65));
      } else if (code >= 97 && code <= 122) {
        return String.fromCodePoint(0x1D5EE + (code - 97));
      } else if (code >= 48 && code <= 57) {
        return String.fromCodePoint(0x1D7EC + (code - 48));
      }
      return char;
    });
  },

  /**
   * Format text bold styling based on requested mode:
   * 'UNICODE' -> Converts *text* or **text** into 𝗧𝗲𝗸𝘀 𝗧𝗲𝗯𝗮𝗹 (Universal bold for Shopee/Tokopedia/FB/IG/etc.)
   * 'WHATSAPP' -> Standard WhatsApp *text* bold format
   * 'MARKDOWN' -> Standard **text** double asterisk format
   */
  formatBoldStyle(text, styleMode = 'UNICODE') {
    if (!text) return '';
    const mode = (styleMode || 'UNICODE').toUpperCase();

    if (mode === 'UNICODE') {
      // Ubah *teks* atau **teks** menjadi karakter Unicode Bold Serbaguna
      return text.replace(/(\*\*|\*)([^\*\n]+)\1/g, (match, p1, inner) => {
        return this.toUnicodeBold(inner);
      });
    } else if (mode === 'MARKDOWN') {
      // Ubah *teks* (WhatsApp) menjadi **teks** (Standard Markdown / Telegram / Discord)
      return text.replace(/(?<!\*)\*([^\*\n]+)\*(?!\*)/g, '**$1**');
    } else if (mode === 'WHATSAPP') {
      // Ubah **teks** menjadi *teks* (WhatsApp)
      return text.replace(/\*\*([^\*\n]+)\*\*/g, '*$1*');
    }

    return text;
  },

  /**
   * Generate HTML rich text version for clipboard (with <b> tags) for Gmail, Word, and web editors
   */
  toHtmlRichText(text) {
    if (!text) return '';
    let html = text.replace(/(\*\*|\*)([^\*\n]+)\1/g, '<b>$2</b>');
    return `<div>${html.replace(/\n/g, '<br>')}</div>`;
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
  },

  /**
   * Translate compiled Indonesian message text to English (Synchronous Local Dictionary)
   */
  translateToEnglish(text) {
    if (!text) return '';
    let translated = text;

    const replacements = [
      // Greetings & Intro
      [/\bHalo kak, terima kasih sudah order di\b/gi, 'Hello, thank you for ordering at'],
      [/\bHalo kak, terima kasih sudah order\b/gi, 'Hello, thank you for ordering'],
      [/\bHalo kak\b/gi, 'Hello'],
      [/\bHai kak\b/gi, 'Hello'],
      [/\bHalo\b/gi, 'Hello'],
      [/\bHai\b/gi, 'Hello'],
      [/\bterima kasih sudah order di\b/gi, 'thank you for ordering at'],
      [/\bterima kasih sudah order\b/gi, 'thank you for ordering'],
      [/\btelah membeli\b/gi, 'purchased'],
      [/\bsudah order\b/gi, 'ordered'],
      [/\bterima kasih\b/gi, 'thank you'],
      [/\bterimakasih\b/gi, 'thank you'],
      [/\bmakasih\b/gi, 'thank you'],
      [/\bpesanan\b/gi, 'order'],
      [/\btransaksi\b/gi, 'transaction'],
      [/\bsiap digunakan!\b/gi, 'is ready to use!'],
      [/\bsiap digunakan\b/gi, 'ready to use'],
      [/\bberhasil dikirim\b/gi, 'successfully sent'],
      [/\btelah aktif\b/gi, 'is now active'],
      [/\bBerikut detail\b/gi, 'Here are the details for your'],
      [/\bBerikut rincian\b/gi, 'Here are the details for your'],
      [/\bBerikut informasi\b/gi, 'Here is the information for your'],
      [/\bBerikut data\b/gi, 'Here is the data for your'],
      [/\bBerikut akun\b/gi, 'Here is your account for'],
      [/\bBerikut link\b/gi, 'Here is your link for'],
      [/\bBerikut akses produk\b/gi, 'Here is your access for product'],
      [/\bakses produk\b/gi, 'product access'],
      [/\bakses akun\b/gi, 'account access'],
      [/\bAnda:\b/gi, ':'],
      [/\bAnda\b/gi, 'you'],

      // Labels & Attributes
      [/\bEmail \/ Link\b/gi, 'Email / Link'],
      [/\bEmail \/ Akses\b/gi, 'Email / Access'],
      [/\bEmail \/ Username\b/gi, 'Email / Username'],
      [/\bLink Akses\b/gi, 'Access Link'],
      [/\bURL Akses\b/gi, 'Access URL'],
      [/\bKata Sandi\b/gi, 'Password'],
      [/\bPassword\b/gi, 'Password'],
      [/\bMasa Aktif\b/gi, 'Active Duration'],
      [/\bMasa Berlaku\b/gi, 'Validity Duration'],
      [/\bDurasi\b/gi, 'Duration'],
      [/\bTanggal Kirim\b/gi, 'Sent Date'],
      [/\bTgl Kirim\b/gi, 'Sent Date'],
      [/\bTanggal Order\b/gi, 'Order Date'],
      [/\bWaktu Kirim\b/gi, 'Sent Time'],
      [/\bExpired Pada\b/gi, 'Expires On'],
      [/\bTanggal Expired\b/gi, 'Expiry Date'],
      [/\bMasa Kadaluarsa\b/gi, 'Expiration Date'],
      [/\bExpired\b/gi, 'Expires'],
      [/\bCatatan Tambahan\b/gi, 'Additional Notes'],
      [/\bCatatan \/ Info\b/gi, 'Notes / Info'],
      [/\bCatatan\b/gi, 'Notes'],
      [/\bKeterangan\b/gi, 'Details'],
      [/\bInfo Tambahan\b/gi, 'Additional Info'],
      [/\bInformasi\b/gi, 'Information'],
      [/\bSyarat & Ketentuan\b/gi, 'Terms & Conditions'],
      [/\bKetentuan Garansi\b/gi, 'Warranty Terms'],
      [/\bKetentuan\b/gi, 'Terms'],
      [/\bGaransi\b/gi, 'Warranty'],
      [/\bAturan\b/gi, 'Rules'],

      // Duration Units
      [/\b(\d+)\s*Hari\b/gi, '$1 Days'],
      [/\b1\s*Hari\b/gi, '1 Day'],
      [/\b(\d+)\s*Minggu\b/gi, '$1 Weeks'],
      [/\b1\s*Minggu\b/gi, '1 Week'],
      [/\b(\d+)\s*Bulan\b/gi, '$1 Months'],
      [/\b1\s*Bulan\b/gi, '1 Month'],
      [/\bHari\b/gi, 'Days'],
      [/\bMinggu\b/gi, 'Weeks'],
      [/\bBulan\b/gi, 'Months'],

      // Common Sentences & Rules
      [/Harap simpan bukti pengiriman ini\./gi, 'Please keep this proof of delivery.'],
      [/Simpan bukti ini/gi, 'Save this proof'],
      [/Jika ada kendala, hubungi kami!/gi, 'If you experience any issues, please contact us!'],
      [/Jika ada kendala/gi, 'If you have any issues'],
      [/Apabila ada kendala/gi, 'If you have any issues'],
      [/Jika ada masalah/gi, 'If you have any problems'],
      [/hubungi kami!/gi, 'contact us!'],
      [/hubungi kami/gi, 'contact us'],
      [/silakan hubungi kami/gi, 'please contact us'],
      [/kontak kami/gi, 'contact us'],
      [/Terima kasih dan selamat menikmati layanan premium!/gi, 'Thank you and enjoy your premium service!'],
      [/selamat menikmati/gi, 'enjoy your'],
      [/layanan premium/gi, 'premium service'],
      [/Aturan: Dilarang mengubah password\/profile pin agar garansi tetap berlaku\./gi, 'Rules: Do not change the password/profile pin to maintain warranty eligibility.'],
      [/Dilarang mengubah password\/profile pin/gi, 'Do not change the password/profile pin'],
      [/Dilarang mengubah password/gi, 'Do not change the password'],
      [/Dilarang ganti/gi, 'Do not change'],
      [/Dilarang ubah/gi, 'Do not change'],
      [/Jangan ganti/gi, 'Do not change'],
      [/Jangan ubah/gi, 'Do not change'],
      [/agar garansi tetap berlaku/gi, 'to keep warranty valid'],
      [/garansi tetap berlaku/gi, 'warranty remains valid'],
      [/garansi hangus/gi, 'warranty voided'],
      [/garansi tidak hangus/gi, 'warranty remains valid'],
      [/Link Undangan Akses Produk/gi, 'Product Access Invite Link'],
      [/Link Undangan Akses/gi, 'Access Invite Link'],
      [/Link Undangan/gi, 'Invite Link'],
      [/Dikirim via Quick Access/gi, 'Sent via Quick Access']
    ];

    replacements.forEach(([pattern, replacement]) => {
      translated = translated.replace(pattern, replacement);
    });

    return translated;
  },

  /**
   * Comprehensive async translation supporting full custom text AI machine translation
   * Translates line-by-line to preserve 100% exact newlines (\n), enters, and paragraph spacing.
   */
  async translateToEnglishAsync(text) {
    if (!text) return '';

    // Pecah teks berdasarkan baris (\n) untuk menjamin 100% presisi enter & baris baru
    const lines = text.split('\n');

    const translatedLines = await Promise.all(lines.map(async (line) => {
      // 1. Pertahankan baris kosong (enter) persis seperti aslinya
      if (!line.trim()) return line;

      // 2. Pertahankan baris pemisah (seperti ------ atau ======) persis tanpa diterjemahkan
      if (/^[-\s=_\*#]{3,}$/.test(line.trim())) return line;

      // 3. Terapkan terjemahan kamus lokal terlebih dahulu
      let localLine = this.translateToEnglish(line);

      try {
        // Proteksi URL dan Email per baris
        const protectedItems = [];
        const maskedLine = localLine.replace(/(https?:\/\/[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (match) => {
          protectedItems.push(match);
          return `___VAL_${protectedItems.length - 1}___`;
        });

        // Terjemahkan baris tunggal via API Online
        const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=en&dt=t&q=${encodeURIComponent(maskedLine)}`;
        const response = await fetch(apiUrl);

        if (response.ok) {
          const data = await response.json();
          if (data && data[0]) {
            let onlineLine = data[0].map(item => item[0] || '').join('');

            // Kembalikan URL & Email yang diproteksi
            protectedItems.forEach((item, index) => {
              const exactTag = `___VAL_${index}___`;
              onlineLine = onlineLine.split(exactTag).join(item);
              const altRegex = new RegExp(`___\\s*VAL_\\s*${index}\\s*___`, 'gi');
              onlineLine = onlineLine.replace(altRegex, item);
            });

            // Rapikan spasi di sekitar asterisk (*) jika ada
            return onlineLine.replace(/\s+\*/g, ' *').replace(/\*\s+/g, '* ');
          }
        }
      } catch (err) {
        // Jika offline/gagal fetch, gunakan hasil kamus lokal
      }

      return localLine;
    }));

    // Gabungkan kembali seluruh baris dengan karakter enter (\n) yang 100% presisi
    return translatedLines.join('\n');
  }
};
