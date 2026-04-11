const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.workspaceMember.findMany({ include: { user: true, workspace: true } })
  .then(console.log)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
