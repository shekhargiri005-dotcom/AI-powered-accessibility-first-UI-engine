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
        const email    = credentials?.email    as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) {
          console.error('[auth debug] Missing email or password');
          return null;
        }

        // ── Owner-only gate ────────────────────────────────────────────────
        if (email.toLowerCase().trim() !== OWNER_EMAIL.toLowerCase().trim()) {
          console.error(`[auth debug] Email mismatch. Received: "${email}", Expected: "${OWNER_EMAIL}"`);
          return null;
        }

        const normalizedEmail = email.toLowerCase().trim();
        let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        let valid = false;

        if (user?.passwordHash) {
          valid = await bcrypt.compare(password, user.passwordHash);
        } else {
          // Fallback: allow legacy .env hashes and migrate them to the DB
          if (!OWNER_PASSWORD_HASH) {
            console.warn('[auth] OWNER_PASSWORD_HASH not set & no DB password — rejecting login.');
            return null;
          }
          valid = await bcrypt.compare(password, OWNER_PASSWORD_HASH);
          if (valid) {
            user = await prisma.user.upsert({
              where: { email: normalizedEmail },
              create: { email: normalizedEmail, passwordHash: OWNER_PASSWORD_HASH, name: OWNER_NAME },
              update: { passwordHash: OWNER_PASSWORD_HASH, name: OWNER_NAME },
            });
            console.log('[auth] Automatically migrated owner into DB auth system.');
          }
        }

        if (!valid) {
          console.error('[auth debug] Password mismatch');
          return null;
        }

        return {
          id:    user?.id || 'owner',
          email: user?.email || OWNER_EMAIL,
          name:  user?.name || OWNER_NAME,
          image: user?.image || null,
        };
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
