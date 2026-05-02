import { NextResponse } from 'next/server';
import { isRedisConfigured } from '@/lib/game-store';

export async function GET() {
  const redisConfigured = isRedisConfigured();

  return NextResponse.json({
    status: redisConfigured ? 'ok' : 'degraded',
    redis: redisConfigured ? 'connected' : 'not_configured',
    message: redisConfigured
      ? 'Redis is configured and ready'
      : 'Redis is NOT configured. Room data will not persist across requests. Please set up Upstash Redis integration in your Vercel project.',
    env: {
      hasKVUrl: !!process.env.KV_REST_API_URL,
      hasKVToken: !!process.env.KV_REST_API_TOKEN,
      hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    }
  });
}
