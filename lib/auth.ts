import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

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

        if (!email || !password) return null;

        // ── Owner-only gate ────────────────────────────────────────────────
        if (email.toLowerCase().trim() !== OWNER_EMAIL.toLowerCase().trim()) {
          return null;
        }

        // ── Fallback: allow dev access when no hash is configured ──────────
        if (!OWNER_PASSWORD_HASH) {
          console.warn('[auth] OWNER_PASSWORD_HASH not set — rejecting all logins in production!');
          return null;
        }

        const valid = await bcrypt.compare(password, OWNER_PASSWORD_HASH);
        if (!valid) return null;

        return {
          id:    'owner',
          email: OWNER_EMAIL,
          name:  OWNER_NAME,
          image: null,
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
