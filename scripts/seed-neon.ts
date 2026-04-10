import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding database...');
  
  // 1. Create the default workspace
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      id: 'default',
      name: 'Default Workspace',
      slug: 'default'
    }
  });
  console.log('✅ Workspace ensured:', workspace.id);

  // 2. Add baseline API settings
  const settings = await prisma.workspaceSettings.upsert({
    where: { 
      workspaceId_provider: { workspaceId: 'default', provider: 'openai' }
    },
    update: {},
    create: {
      workspaceId: 'default',
      provider: 'openai',
      model: 'gpt-4o',
      encryptedApiKey: 'SEED_PLACEHOLDER_KEY',
    }
  });
  console.log('✅ Settings ensured for:', settings.provider);

  // 3. Add a log entry for performance graphs
  await prisma.usageLog.create({
    data: {
      workspaceId: 'default',
      provider: 'openai',
      model: 'gpt-4o',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latencyMs: 150,
      costUsd: 0,
    }
  });
  console.log('✅ Usage log baseline added');
}

main()
  .catch(e => { console.error('Seed error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
