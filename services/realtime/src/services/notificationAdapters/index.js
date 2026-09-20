/**
 * Base adapter interface for Notifications
 */
class NotificationAdapter {
  constructor(providerName) {
    this.providerName = providerName;
  }

  async send(to, content, metadata = {}) {
    throw new Error('Not implemented');
  }
}

class MockSmsAdapter extends NotificationAdapter {
  constructor() {
    super('MOCK_SMS');
  }

  async send(to, content, metadata = {}) {
    console.log(`[SMS_ADAPTER] Sending to ${to}: ${content}`);
    // Simulate latency
    await new Promise(r => setTimeout(r, 200));
    
    // Simulate 99% success rate
    if (Math.random() > 0.99) {
      throw new Error('SMS Provider Outage');
    }

    return {
      success: true,
      providerId: `sms-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      status: 'DELIVERED'
    };
  }
}

class MockEmailAdapter extends NotificationAdapter {
  constructor() {
    super('MOCK_EMAIL');
  }

  async send(to, content, metadata = {}) {
    console.log(`[EMAIL_ADAPTER] Sending to ${to}:\n${content}`);
    await new Promise(r => setTimeout(r, 300));
    
    return {
      success: true,
      providerId: `email-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      status: 'DELIVERED'
    };
  }
}

class MockInAppAdapter extends NotificationAdapter {
  constructor() {
    super('IN_APP');
  }

  async send(toUserId, content, metadata = {}) {
    console.log(`[IN_APP_ADAPTER] Pushing to User ${toUserId}: ${content}`);
    // In a real system, this would insert into a Notifications table or emit a WebSocket event
    return {
      success: true,
      providerId: `inapp-${Date.now()}`,
      status: 'DELIVERED'
    };
  }
}

module.exports = {
  smsAdapter: new MockSmsAdapter(),
  emailAdapter: new MockEmailAdapter(),
  inAppAdapter: new MockInAppAdapter()
};
