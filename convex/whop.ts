import { WhopClient, WhopEnvironment } from '@whop/sdk';
import { env } from './_generated/server';

export function whop() {
  if (!env.WHOP_ENVIRONMENT) throw new Error('WHOP_ENVIRONMENT must be "sandbox" or "production"');
  return new WhopClient({
    token: env.WHOP_API_KEY,
    environment: env.WHOP_ENVIRONMENT === 'sandbox' ? WhopEnvironment.Sandbox : WhopEnvironment.Production,
  });
}

export const dollars = (cents: number) => cents / 100;

export function purchaseUrlOf(config: { id: string; purchase_url?: string | null }): string {
  if (!config.purchase_url) throw new Error(`Whop checkout ${config.id} has no purchase_url`);
  return config.purchase_url;
}
