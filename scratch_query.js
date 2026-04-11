const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.workspace.findMany({ include: { members: true } })
  .then(console.log)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
