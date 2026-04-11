const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.workspace.create({
  data: {
    name: 'Test Test Workspace',
    slug: 'test-test-workspace-' + Date.now().toString(36),
    members: {
      create: {
        userId: 'owner',
        role: 'OWNER',
      },
    },
  },
}).then(console.log).catch(console.error).finally(()=>prisma.$disconnect());
