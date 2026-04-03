'use client';

import React from 'react';
import { signIn } from 'next-auth/react';
import { Github, Layout, ShieldCheck, Zap } from 'lucide-react';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 selection:bg-blue-500/30">
      {/* Background Glows */}
      <div className="fixed top-1/4 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-1/4 -right-20 w-96 h-96 bg-violet-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[440px] z-10">
        {/* Brand Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 p-[1px] mb-6 shadow-2xl shadow-blue-500/20">
            <div className="w-full h-full bg-gray-950 rounded-[15px] flex items-center justify-center">
              <div className="w-5 h-5 rounded-full bg-blue-400 animate-pulse" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-3">
            Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">AI UI Engine</span>
          </h1>
          <p className="text-gray-400 text-sm max-w-[320px] mx-auto leading-relaxed">
            The next-generation, accessibility-first component generation platform for professional engineers.
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800/60 rounded-3xl p-8 shadow-2xl">
          <div className="space-y-6">
            <button
              onClick={() => signIn('github', { callbackUrl: '/' })}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-black hover:bg-gray-100 rounded-2xl font-bold transition-all transform active:scale-[0.98] shadow-lg shadow-white/5"
            >
              <Github className="w-5 h-5" />
              Continue with GitHub
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-gray-900/0 px-2 text-gray-500 font-bold">Trusted Infrastructure</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-800/30 border border-gray-800/40">
                <div className="mt-1 p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-200">Secure Isolation</h4>
                  <p className="text-xs text-gray-500 mt-1">Multi-tenant workspace architecture built with enterprise-grade security.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-800/30 border border-gray-800/40">
                <div className="mt-1 p-2 rounded-lg bg-violet-500/10 text-violet-400">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-200">Zero-Config Prev</h4>
                  <p className="text-xs text-gray-500 mt-1">Instantly preview and refine components in real-time context.</p>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-[10px] text-gray-600 font-medium">
            By continuing, you agree to our <a href="#" className="underline hover:text-gray-400 transition-colors">Terms of Service</a> and <a href="#" className="underline hover:text-gray-400 transition-colors">Privacy Policy</a>.
          </p>
        </div>

        {/* Footer info */}
        <div className="mt-10 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-gray-600">
                <Layout className="w-3.5 h-3.5" />
                <span className="text-xs font-bold uppercase tracking-widest">Next.js 16 Ready</span>
            </div>
        </div>
      </div>
    </div>
  );
}
