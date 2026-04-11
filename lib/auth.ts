import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

// ── Owner credentials (set these in .env.local) ───────────────────────────────
const OWNER_EMAIL        = process.env.OWNER_EMAIL        ?? '';
const OWNER_PASSWORD_HASH = process.env.OWNER_PASSWORD_HASH ?? '';
const OWNER_NAME         = process.env.OWNER_NAME         ?? 'Shekhar Giri';

export const { handlers, auth, signIn, signOut } = NextAuth({
  // ── JWT-only sessions (required for CredentialsProvider) ─────────────────
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 }, // 7 days

  providers: [
    Credentials({
      id: 'credentials',
      name: 'Owner Access',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Wrap entirely — bcrypt.compare throws on malformed hashes;
        // Prisma throws on network issues. Both must return null, not crash.
        try {
          const email    = credentials?.email    as string | undefined;
          const password = credentials?.password as string | undefined;

          if (!email || !password) return null;

          const normalizedEmail = email.toLowerCase().trim();
          let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
          let valid = false;

          if (user?.passwordHash) {
            // DB user exists — compare against their stored hash
            valid = await bcrypt.compare(password, user.passwordHash);
          } else {
            // No DB record yet — fall back to the env-supplied master hash
            if (!OWNER_PASSWORD_HASH || !OWNER_PASSWORD_HASH.startsWith('$2')) {
              // Guard: bcrypt.compare throws if hash is not a valid bcrypt string
              console.warn('[auth] OWNER_PASSWORD_HASH not set or not a valid bcrypt hash.');
              return null;
            }
            valid = await bcrypt.compare(password, OWNER_PASSWORD_HASH);
            if (valid) {
              // Auto-provision this email into the DB so future logins are DB-backed
              try {
                user = await prisma.user.upsert({
                  where:  { email: normalizedEmail },
                  create: { email: normalizedEmail, passwordHash: OWNER_PASSWORD_HASH, name: email.split('@')[0] },
                  update: { passwordHash: OWNER_PASSWORD_HASH },
                });
                console.log(`[auth] Provisioned access for ${normalizedEmail}.`);
              } catch (dbErr) {
                // DB write failed — user is still authenticated for this session
                console.error('[auth] DB upsert failed (non-fatal):', dbErr);
              }
            }
          }

          if (!valid) return null;

          return {
            id:    user?.id    || 'owner',
            email: user?.email || normalizedEmail,
            name:  user?.name  || OWNER_NAME,
            image: user?.image || null,
          };
        } catch (err) {
          console.error('[auth] Unexpected error in authorize (returning null):', err);
          return null;
        }
      },
    }),
  ],

  // ── JWT / Session callbacks ───────────────────────────────────────────────
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id    = user.id;
        token.email = user.email;
        token.name  = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id    = token.id    as string;
        session.user.email = token.email as string;
        session.user.name  = token.name  as string;
      }
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },
});
