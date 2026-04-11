import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const version = await prisma.projectVersion.findFirst({ orderBy: { timestamp: 'desc' } });
  console.log(version.code);
}
main().catch(console.error);