import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { Resend } from 'resend';

// Configure this in .env
const processEmail = process.env.OWNER_EMAIL || '';
const resendApiKey = process.env.RESEND_API_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // To prevent user enumeration, we don't throw an error if the user isn't found
    // However, since it's a single owner system, if it doesn't match OWNER_EMAIL we can softly reject
    if (normalizedEmail !== processEmail.toLowerCase().trim()) {
      return NextResponse.json({ success: true }); // Fake success for enumeration protection
    }

    // Verify user exists in the DB
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return NextResponse.json({ success: true }); 
    }

    // 1. Generate secure token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 2. Set expiration (15 minutes)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // 3. Clear existing tokens for this user and create a new one
    await prisma.verificationToken.deleteMany({
      where: { identifier: normalizedEmail }
    });

    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: tokenHash,
        expires: expiresAt,
      }
    });

    // 4. Construct reset link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get('origin') || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

    console.log('\n======================================================');
    console.log('[SECURITY] PASSWORD RESET REQUESTED');
    console.log(`[SECURITY] A password reset was requested for ${normalizedEmail}`);
    console.log(`[SECURITY] The following reset link has been generated:`);
    console.log('\n' + resetUrl + '\n');
    console.log('======================================================\n');

    // 5. Dispatch email via Resend
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: 'AI UI Engine Security <onboarding@resend.dev>', // Update with verified domain in production
        to: normalizedEmail,
        subject: 'AI UI Engine - Password Reset Sequence',
        html: `
          <div style="font-family: monospace; background-color: #0B0F19; color: #fff; padding: 40px; border-radius: 8px;">
            <h2 style="color: #a78bfa;">AUTHORISATION PROTOCOL INITIATED</h2>
            <p style="color: #cbd5e1;">A password reset sequence was requested for the AI UI Engine.</p>
            <p style="color: #cbd5e1;">Click the link below to verify your cryptographic identity and construct a new password hash:</p>
            <br/>
            <a href="${resetUrl}" style="background-color: #7c3aed; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Identity & Reset Password</a>
            <br/><br/>
            <p style="color: #64748b; font-size: 12px;">This transmission will expire in exactly 15 minutes.</p>
            <p style="color: #64748b; font-size: 12px;">If you did not authorize this action, ignore this payload.</p>
          </div>
        `
      });
      console.log('[auth debug] Reset email dispatched safely via Resend.');
    } else {
      console.warn('[auth debug] RESEND_API_KEY is not configured. Email bypassed. Link generated only in console.');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[auth error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
