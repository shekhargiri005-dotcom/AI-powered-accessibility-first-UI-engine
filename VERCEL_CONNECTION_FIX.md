# Vercel Deployment Connection Error Troubleshooting

## Issue Summary
Your Vercel deployment is showing "Connection error" for `/api/think` and `/api/classify` endpoints.

## Root Cause Analysis

The error logs indicate:
```
[WARN] /api/think | Thinking plan generation failed — returning deterministic fallback plan
  error: "Thinking engine API error: Connection error."

[WARN] /api/classify | Classification failed
  error: "Classifier API error: Connection error."
```

This typically occurs when:
1. **API keys are not configured** in Vercel's environment variables
2. **Network connectivity issues** between Vercel and AI provider endpoints
3. **Provider API endpoints** are unreachable or changed

## Immediate Solutions

### 1. Configure Environment Variables in Vercel

Go to your Vercel project settings → **Environment Variables** and add:

**Required (at least ONE):**
```bash
# Option 1: Groq (Recommended - fast, generous free tier)
GROQ_API_KEY=gsk_your_key_here

# Option 2: Google Gemini
GOOGLE_API_KEY=AIzaSy_your_key_here
# OR
GEMINI_API_KEY=AIzaSy_your_key_here

# Option 3: Anthropic
ANTHROPIC_API_KEY=sk-ant_your_key_here

# Option 4: OpenAI
OPENAI_API_KEY=sk-proj_your_key_here

# Option 5: Ollama Cloud (self-hosted or cloud instances)
OLLAMA_BASE_URL=https://your-ollama-instance.com/v1
# Note: Ollama doesn't require an API key, just the base URL

# 🌟 UNIVERSAL KEY - Works with ALL providers above
# Fill this ONE key and your UI Engine will work immediately
LLM_KEY=your_api_key_here
```

**How LLM_KEY Works:**
- If you set `LLM_KEY`, the engine automatically uses it with Groq (default provider)
- This is the quickest way to get your UI Engine running - just ONE key!
- You can still override with specific provider keys if needed

**Provider Priority Order** (from `resolveDefaultAdapter.ts`):
1. Groq (fastest, best free tier)
2. Google Gemini
3. Anthropic
4. OpenAI (last - quota exhausts quickly)
5. Ollama (cloud or local - no API key needed, just URL)

### 2. Verify Environment Variables Are Set

After adding the variables to Vercel:
1. **Redeploy** your application (environment changes require a new deployment)
2. Check the deployment logs to confirm the variables are loaded
3. Test the endpoints again

### 3. Check Vercel Function Logs

In Vercel dashboard:
1. Go to **Logs** → **Functions**
2. Look for logs from `[resolveDefaultAdapter]` and `[getWorkspaceAdapter]`
3. These will show which provider is being selected and if keys are found

Expected successful logs:
```
[resolveDefaultAdapter] Resolving adapter for purpose: CLASSIFIER
[resolveDefaultAdapter] ✓ Found GROQ_API_KEY, using provider: groq
[getWorkspaceAdapter] ✓ Using universal LLM_KEY for groq
```

Error logs indicating missing keys:
```
[resolveDefaultAdapter] ✗ No API keys found for purpose: CLASSIFIER
[getWorkspaceAdapter] ✗ No API key found for groq
```

## Enhanced Error Logging

I've updated the code to provide better diagnostic information:

### Changes Made:

1. **Added timeout detection** to network error handling
2. **Enhanced error logging** with provider, model, and API key status
3. **Added request timeout constants** (30 seconds) for future timeout implementation

### Updated Files:
- `lib/ai/intentClassifier.ts` - Better error logging
- `lib/ai/thinkingEngine.ts` - Better error logging

After redeploying, you'll see detailed error information like:
```
[intentClassifier] Classification failed for provider=groq, model=llama-3.3-70b-versatile:
{
  error: "Connection error.",
  provider: "groq",
  model: "llama-3.3-70b-versatile",
  workspaceId: "default",
  hasApiKey: false  // ← This tells you if the key is configured
}
```

## Advanced Troubleshooting

### Check if Vercel Can Reach AI Providers

Vercel serverless functions should have outbound internet access, but you can verify:

1. **Test with a simple API route:**
   Create `app/api/test-connection/route.ts`:
   ```typescript
   import { NextResponse } from 'next/server';
   
   export async function GET() {
     try {
       const res = await fetch('https://api.groq.com/openai/v1/models', {
         headers: {
           'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
         }
       });
       return NextResponse.json({ 
         status: res.status,
         ok: res.ok 
       });
     } catch (error) {
       return NextResponse.json({ 
         error: error.message 
       }, { status: 500 });
     }
   }
   ```

2. **Check Vercel's outbound networking:**
   - Vercel Pro/Enterprise: No restrictions
   - Vercel Hobby: May have rate limits on outbound requests

### Fallback Behavior

Your app already has graceful fallbacks:
- **`/api/classify`**: Returns 400 error (but UI handles this with default intent)
- **`/api/think`**: Returns a deterministic fallback plan (line 66-68 in `route.ts`)

This means **the app will still work** even with connection errors, just with reduced intelligence.

## Prevention

### 1. Use Vercel's Environment Variable Groups
Organize your variables:
- `production` - Production API keys
- `preview` - Staging/test keys
- `development` - Local development keys

### 2. Monitor API Usage
Set up alerts for:
- API quota limits
- Rate limiting (429 errors)
- Connection failures

### 3. Consider Vercel's Edge Functions
For better performance and reliability, consider moving these endpoints to Edge Functions:
```typescript
// In your route.ts file
export const runtime = 'edge';
```

Note: Edge Functions have different limitations (no Node.js APIs, smaller bundle size).

## Quick Fix Checklist

- [ ] Add at least one API key to Vercel environment variables (or just set `LLM_KEY`)
- [ ] For Ollama cloud: Set `OLLAMA_BASE_URL` to your cloud instance URL
- [ ] Redeploy the application (required for env var changes to take effect)
- [ ] Check Vercel function logs for `[resolveDefaultAdapter]` messages
- [ ] Test the `/api/classify` and `/api/think` endpoints
- [ ] Verify the fallback plan is being generated correctly if needed
- [ ] Monitor for recurring connection errors

## All 5 Supported Adapters

Your UI Engine supports **5 AI providers** out of the box:

| Provider | Env Variable | Base URL | Notes |
|----------|-------------|----------|-------|
| **Groq** | `GROQ_API_KEY` | Auto-configured | ⚡ Fastest, generous free tier |
| **Google** | `GOOGLE_API_KEY` or `GEMINI_API_KEY` | Auto-configured | 🚀 Gemini models |
| **Anthropic** | `ANTHROPIC_API_KEY` | Auto-configured | 🎯 Claude models |
| **OpenAI** | `OPENAI_API_KEY` | Auto-configured | 🌟 GPT models |
| **Ollama** | `OLLAMA_BASE_URL` | Your URL | 💻 Cloud or local, no API key needed |

## Need More Help?

If the issue persists after adding API keys:
1. Share the Vercel function logs showing `[getWorkspaceAdapter]` output
2. Check if your API key has the correct permissions/quotas
3. Verify the API key works locally first (`npm run dev`)
4. Consider trying a different provider (e.g., switch from OpenAI to Groq)
5. For Ollama: Ensure your cloud instance is accessible from Vercel's servers
