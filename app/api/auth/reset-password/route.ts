import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const { email, token, newPassword } = await req.json();

    if (!email || !token || !newPassword) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Verify token exists and is valid
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const verificationRecord = await prisma.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        token: tokenHash,
      }
    });

    if (!verificationRecord) {
      return NextResponse.json({ error: 'Invalid or missing recovery token' }, { status: 400 });
    }

    if (verificationRecord.expires < new Date()) {
      return NextResponse.json({ error: 'Recovery token has expired. Please request a new one.' }, { status: 400 });
    }

    // 2. Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // 3. Update user and invalidate token
    await prisma.$transaction([
      prisma.user.update({
        where: { email: normalizedEmail },
        data: { passwordHash: newPasswordHash }
      }),
      prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: normalizedEmail,
            token: tokenHash
          }
        }
      })
    ]);

    console.log(`[auth debug] Password successfully reset for ${normalizedEmail}.`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[auth error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
