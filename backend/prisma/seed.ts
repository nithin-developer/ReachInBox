import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create or upsert demo user (matching the Oliver Brown profile from screenshots)
  const user = await prisma.user.upsert({
    where: { email: 'oliver.brown@domain.io' },
    update: {},
    create: {
      email: 'oliver.brown@domain.io',
      name: 'Oliver Brown',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      googleId: 'demo-google-id-12345',
      senderAccounts: {
        create: [
          {
            email: 'oliver.brown@domain.io',
            name: 'Oliver Brown (Work)',
            hourlyLimit: 50,
          },
        ],
      },
    },
    include: {
      senderAccounts: true,
    },
  });

  console.log(`✅ Seeded user: ${user.name} (${user.email}) with sender account ID: ${user.senderAccounts[0]?.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
