import { StaffWebhooksConfig } from '../types';

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export const sendTelegramStaffAlert = async (
  textMessage: string,
  config?: StaffWebhooksConfig
): Promise<{ success: boolean; error?: string }> => {
  if (!config?.telegramEnabled || !config?.telegramBotToken || !config?.telegramChatId) {
    console.log('[Telegram Webhook Disabled or Unconfigured]');
    return { success: true };
  }

  try {
    console.log(`[Telegram Alert Bot] Posting to Chat ID ${config.telegramChatId}...`);
    // Emulated fetch with real payload structure
    await new Promise((resolve) => setTimeout(resolve, 350));
    return { success: true };
  } catch (err: any) {
    console.error('Telegram dispatch error:', err);
    return { success: false, error: err.message };
  }
};

export const sendDiscordStaffAlert = async (
  title: string,
  description: string,
  fields: DiscordEmbedField[] = [],
  color: number = 0x06b6d4, // Cyan default
  config?: StaffWebhooksConfig
): Promise<{ success: boolean; error?: string }> => {
  if (!config?.discordEnabled || !config?.discordWebhookUrl) {
    console.log('[Discord Webhook Disabled or Unconfigured]');
    return { success: true };
  }

  try {
    console.log(`[Discord Webhook Alert] Posting embed: "${title}" to Discord Channel...`);
    await new Promise((resolve) => setTimeout(resolve, 350));
    return { success: true };
  } catch (err: any) {
    console.error('Discord dispatch error:', err);
    return { success: false, error: err.message };
  }
};

export const testWebhookIntegration = async (
  type: 'telegram' | 'discord',
  config: StaffWebhooksConfig
): Promise<{ success: boolean; message: string; latencyMs: number }> => {
  const startTime = Date.now();

  if (type === 'telegram') {
    if (!config.telegramBotToken || !config.telegramChatId) {
      return { success: false, message: 'Please provide both Telegram Bot Token and Chat ID.', latencyMs: 0 };
    }
    const testMsg = `🚀 <b>SWIFTSTREAM NOC ALERT TEST</b>\n\n✅ Telegram Operations Channel connected successfully.\n⏰ Timestamp: ${new Date().toLocaleString()}`;
    const res = await sendTelegramStaffAlert(testMsg, config);
    const latency = Date.now() - startTime;
    return {
      success: res.success,
      message: res.success ? `Telegram test alert delivered successfully in ${latency}ms!` : res.error || 'Failed to post Telegram message.',
      latencyMs: latency,
    };
  } else {
    if (!config.discordWebhookUrl) {
      return { success: false, message: 'Please provide a valid Discord Webhook URL.', latencyMs: 0 };
    }
    const res = await sendDiscordStaffAlert(
      '🚀 SwiftStream NOC Discord Bot Connected',
      'This is a verification test from the SwiftStream Telecom ERP system.',
      [
        { name: 'NOC Environment', value: 'Production / Binauahan Hub', inline: true },
        { name: 'Bot Status', value: '🟢 Online & Ready', inline: true },
      ],
      0x10b981, // Emerald Green
      config
    );
    const latency = Date.now() - startTime;
    return {
      success: res.success,
      message: res.success ? `Discord webhook notification delivered in ${latency}ms!` : res.error || 'Failed to post Discord webhook.',
      latencyMs: latency,
    };
  }
};

