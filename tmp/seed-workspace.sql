-- WorkspaceSettings: default workspace, openai provider
INSERT OR IGNORE INTO "WorkspaceSettings" ("id","workspaceId","provider","model","encryptedApiKey","updatedAt")
VALUES (
  '35f621ef-5996-42b3-8b93-3c0f6a406b3f',
  'default',
  'openai',
  'gpt-4o',
  'PLACEHOLDER_SET_REAL_KEY_IN_ENV',
  '2026-04-10T09:14:09.331Z'
);

-- UsageLog: seed a zero-cost row so the table shows as active
INSERT OR IGNORE INTO "UsageLog"
  ("id","workspaceId","provider","model","promptTokens","completionTokens","totalTokens","latencyMs","costUsd","cached","createdAt")
VALUES (
  '11ca95d0-19e4-4d1b-bb83-a4ea6cf2f3bc',
  'default',
  'openai',
  'gpt-4o',
  0, 0, 0, 0, 0.0, false,
  '2026-04-10T09:14:09.331Z'
);