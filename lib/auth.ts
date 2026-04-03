import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import GitHub from 'next-auth/providers/github';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
    // Ensure we create a default workspace for new users on signup
    async signIn({ user, account, profile }) {
        if (!user.id) return true;
        
        // Check if user has any workspaces
        const memberships = await prisma.workspaceMember.findFirst({
            where: { userId: user.id }
        });

        if (!memberships) {
            // Create a default Personal Workspace for the new user
            const workspace = await prisma.workspace.create({
                data: {
                    name: `${user.name || 'Personal'}'s Workspace`,
                    slug: `personal-${user.id.slice(0, 8)}`,
                    members: {
                        create: {
                            userId: user.id,
                            role: 'OWNER'
                        }
                    }
                }
            });
        }
        return true;
    }
  },
  pages: {
    signIn: '/login',
  },
});
