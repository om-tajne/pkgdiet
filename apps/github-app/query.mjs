import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('Orgs:', await prisma.org.findMany());
  console.log('Repos:', await prisma.repo.findMany());
  console.log('CheckRuns:', await prisma.checkRun.findMany());
}
main().catch(console.error).finally(() => prisma.$disconnect());
