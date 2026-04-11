import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// ── Single access password (bcrypt hash stored in env) ─────────────────────────
// Generate with: node -e "require('bcryptjs').hash('YOUR_PW',12).then(console.log)"
const ACCESS_HASH = process.env.OWNER_PASSWORD_HASH ?? '';
const OWNER_NAME  = process.env.OWNER_NAME  ?? 'Owner';
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'owner@localhost';

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:    process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,  // required for Vercel preview + production URLs

  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 }, // 7 days

  providers: [
    Credentials({
      id:   'credentials',
      name: 'Access',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const password = (credentials?.password as string | undefined)?.trim();

        // Guard: need a password and a valid bcrypt hash in env
        if (!password || !ACCESS_HASH.startsWith('$2')) return null;

        try {
          const valid = await bcrypt.compare(password, ACCESS_HASH);
          if (!valid) return null;

          // Any email + correct password = access granted
          const email = ((credentials?.email as string | undefined) ?? OWNER_EMAIL).toLowerCase().trim();
          return { id: 'owner', email, name: OWNER_NAME, image: null };
        } catch {
          return null;
        }
      },
    }),
  ],

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
