import { prisma } from '../lib/prisma';
import { getWorkspaceApiKey } from '../lib/security/workspaceKeyService';
import { encryptionService } from '../lib/security/encryption';

async function verify() {
  console.log('🚀 Starting Multi-tenancy Isolation Test...');

  // 0. Cleanup any stale mock data
  const staleWss = await prisma.workspace.findMany({ where: { slug: { in: ['ws-a', 'ws-b'] } } });
  const staleWsIds = staleWss.map(w => w.id);
  const staleUsers = await prisma.user.findMany({ where: { email: { in: ['a@test.com', 'b@test.com'] } } });
  const staleUserIds = staleUsers.map(u => u.id);

  if (staleWsIds.length > 0) {
    await prisma.workspaceSettings.deleteMany({ where: { workspaceId: { in: staleWsIds } } });
  }
  if (staleUserIds.length > 0) {
    await prisma.workspaceMember.deleteMany({ where: { userId: { in: staleUserIds } } });
  }
  await prisma.workspace.deleteMany({ where: { slug: { in: ['ws-a', 'ws-b'] } } });
  await prisma.user.deleteMany({ where: { email: { in: ['a@test.com', 'b@test.com'] } } });

  // 1. Setup Mock Users
  const userA = await prisma.user.create({ data: { name: 'User A', email: 'a@test.com' } });
  const userB = await prisma.user.create({ data: { name: 'User B', email: 'b@test.com' } });

  // 2. Setup Workspaces
  const wsA = await prisma.workspace.create({ data: { name: 'Workspace A', slug: 'ws-a' } });
  const wsB = await prisma.workspace.create({ data: { name: 'Workspace B', slug: 'ws-b' } });

  // 3. Link them (User A -> WS A, User B -> WS B)
  await prisma.workspaceMember.create({ data: { userId: userA.id, workspaceId: wsA.id, role: 'OWNER' } });
  await prisma.workspaceMember.create({ data: { userId: userB.id, workspaceId: wsB.id, role: 'OWNER' } });

  // 4. Set unique API keys
  const encryptedKeyA = encryptionService.encrypt('KEY-FOR-A');
  await prisma.workspaceSettings.create({
    data: { workspaceId: wsA.id, provider: 'openai', encryptedApiKey: encryptedKeyA }
  });

  console.log('✅ Mock data seeded.');

  // 5. Test Cases
  
  // Case 1: User A accesses Workspace A (Owner) -> Should PASS
  const key1 = await getWorkspaceApiKey('openai', wsA.id, userA.id);
  console.log('Test 1 (Owner Access):', key1 === 'KEY-FOR-A' ? 'PASS ✅' : 'FAIL ❌');

  // Case 2: User B accesses Workspace A (Non-member) -> Should FAIL (return null)
  const key2 = await getWorkspaceApiKey('openai', wsA.id, userB.id);
  console.log('Test 2 (Cross-tenant Access Blocked):', key2 === null ? 'PASS ✅' : 'FAIL ❌');

  // Case 3: Public access to Workspace A (No userId) -> Should PASS (falls back to env which is ok for now, or just returns from DB if we didn't block it yet- but our service blocks it if userId is provided and mismatch, let's see)
  // Our code: if (userId && workspaceId !== DEFAULT_WORKSPACE) { check membership }
  // So if no userId, it currently passes (legacy behavior for internal cron/tests). 
  
  // Cleanup
  await prisma.workspaceSettings.deleteMany({ where: { workspaceId: { in: [wsA.id, wsB.id] } } });
  await prisma.workspaceMember.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.workspace.deleteMany({ where: { id: { in: [wsA.id, wsB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });

  console.log('🧹 Cleanup finished.');
}

verify().catch(e => {
  console.error('❌ Verification failed:', e);
  process.exit(1);
});
