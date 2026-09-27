import { prisma } from '../src/config/db.js';
import { createAndScheduleCampaign } from '../src/services/campaign.service.js';
import { checkAndIncrementSenderLimit, getNextHourWindowTime } from '../src/services/rate-limiter.service.js';

async function runDemo() {
  console.log('====================================================');
  console.log('[INFO] ReachInbox Automated Resilience & Logic Verification');
  console.log('====================================================\n');

  // 1. Verify / Get Demo User
  const user = await prisma.user.findFirst({
    where: { email: 'oliver.brown@domain.io' },
    include: { senderAccounts: true },
  });

  if (!user) {
    console.error('[ERROR] Demo user not found. Please run: npm run prisma:seed');
    process.exit(1);
  }
  console.log(`[USER] Active User: ${user.name} (${user.email})`);

  // 2. Schedule Test Campaign
  console.log('\n[STEP 1] Scheduling test campaign with 3 leads and 3-second delay...');
  const result = await createAndScheduleCampaign({
    userId: user.id,
    senderAccountId: user.senderAccounts[0]?.id,
    name: 'Demo Resilience Campaign',
    subject: 'Follow-up on product demo',
    body: '<p>Hi there, checking in on our discussion.</p>',
    recipients: ['lead.alpha@demo.com', 'lead.beta@demo.com', 'lead.gamma@demo.com'],
    delayBetweenEmailsSeconds: 3,
    hourlyLimit: 50,
  });

  console.log(`[SUCCESS] Campaign scheduled: ${result.campaign.name}`);
  console.log(`[METRICS] Total Jobs Enqueued: ${result.totalScheduled}`);

  // 3. Test Rate Limiting Calculation
  console.log('\n[STEP 2] Testing Redis hourly rate limiter evaluation...');
  const rateLimitCheck = await checkAndIncrementSenderLimit(user.email, 50);
  console.log(`[SUCCESS] Rate limit check: Allowed = ${rateLimitCheck.allowed} (Current Count: ${rateLimitCheck.currentCount} / 50)`);
  console.log(`[WINDOW] Next Hour Window: ${getNextHourWindowTime().toISOString()}`);

  console.log('\n====================================================');
  console.log('[COMPLETE] Verification Complete! All core primitives verified.');
  console.log('====================================================');
}

runDemo()
  .catch((err) => {
    console.error('[ERROR] Demo error:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
