const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { smsAdapter, emailAdapter, inAppAdapter } = require('./notificationAdapters');
const { ensureUserAndWallet } = require('./walletService');

class NotificationService {
  constructor() {
    this.sensitiveKeys = ['otp', 'password', 'secret', 'mfa', 'pin', 'token', 'cvv'];
  }

  /**
   * Safely interpolates variables into a template string.
   */
  _interpolate(templateStr, variables) {
    let result = templateStr;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

  /**
   * Redacts sensitive data from variables before logging.
   */
  _redact(variables) {
    const redacted = { ...variables };
    for (const key of Object.keys(redacted)) {
      const lowerKey = key.toLowerCase();
      if (this.sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        redacted[key] = '***REDACTED***';
      }
    }
    return redacted;
  }

  /**
   * Fetches or creates a default template for demonstration purposes.
   */
  async _getTemplate(name, channel) {
    let template = await prisma.notificationTemplate.findUnique({
      where: { name }
    });

    if (!template) {
      // Auto-seed for development
      let content = "Notification: {{message}}";
      if (name === 'OTP_LOGIN') content = "Your WinDaq login OTP is {{otp}}. Do not share this with anyone.";
      if (name === 'DEPOSIT_SUCCESS') content = "Success! ₹{{amount}} has been deposited to your WinDaq wallet.";
      if (name === 'WITHDRAWAL_REQUEST') content = "Your withdrawal of ₹{{amount}} is being processed.";
      if (name === 'PROMO_ALERT') content = "Hey! Claim your new bonus: {{bonusName}}.";

      template = await prisma.notificationTemplate.create({
        data: { name, channel, content }
      });
    }

    return template;
  }

  /**
   * Dispatch a notification to a user.
   * @param {string} userId - Target user ID
   * @param {string} templateName - Name of the template to use
   * @param {object} variables - Key-value pairs for interpolation
   * @param {array} channels - Preferred channels ['SMS', 'EMAIL', 'IN_APP']
   * @param {boolean} isTransactional - If true, bypasses marketing opt-outs
   */
  async dispatch(userId, templateName, variables, channels = ['IN_APP'], isTransactional = false) {
    let user = await prisma.user.findUnique({
      where: { id: userId },
      include: { notifPrefs: true }
    });

    if (!user) {
      await ensureUserAndWallet(prisma, userId);
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: { notifPrefs: true }
      });
    }

    const prefs = user?.notifPrefs || { marketingSms: true, marketingEmail: true, transactionalInApp: true };

    const results = [];

    for (const channel of channels) {
      // 1. Check Preferences
      if (!isTransactional) {
        if (channel === 'SMS' && !prefs.marketingSms) {
          console.log(`[NOTIF_ENGINE] Skipped SMS to ${userId} due to opt-out.`);
          continue;
        }
        if (channel === 'EMAIL' && !prefs.marketingEmail) {
          console.log(`[NOTIF_ENGINE] Skipped EMAIL to ${userId} due to opt-out.`);
          continue;
        }
      }

      // 2. Fetch Template & Interpolate (with real variables)
      const template = await this._getTemplate(templateName, channel);
      const messageContent = this._interpolate(template.content, variables);

      // 3. Dispatch via Adapter
      let adapter;
      let to;
      
      if (channel === 'SMS') {
        adapter = smsAdapter;
        to = user.phone;
      } else if (channel === 'EMAIL') {
        adapter = emailAdapter;
        to = `${userId}@windaq.local`; // Mock email
      } else {
        adapter = inAppAdapter;
        to = userId;
      }

      let status = 'PENDING';
      let providerResponse = null;

      try {
        const result = await adapter.send(to, messageContent, { templateName });
        status = 'SENT';
        providerResponse = result;
      } catch (err) {
        status = 'FAILED';
        providerResponse = { error: err.message };
        console.error(`[NOTIF_ENGINE] Failed to send ${channel} to ${userId}: ${err.message}`);
      }

      // 4. Log Safely (Redact sensitive variables)
      const logEntry = await prisma.notificationLog.create({
        data: {
          userId,
          templateName,
          channel,
          status,
          providerResponse: {
            ...providerResponse,
            safeVariables: this._redact(variables) // Safe for admin visibility
          }
        }
      });

      results.push(logEntry);
    }

    return results;
  }
}

module.exports = new NotificationService();
