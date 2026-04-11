'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, ArrowRight, Loader2, CheckCircle2, ChevronLeft, ShieldCheck, Cpu } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your owner email address.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request password reset.');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Server error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center p-4 relative selection:bg-violet-500/30">
      
      {/* Background decorations */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
      </div>

      <div className="w-full max-w-[420px] z-10 relative space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30 mb-2">
            <Mail className="w-7 h-7 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Recovery Protocol</h1>
          <p className="text-sm text-slate-400 max-w-[300px] mx-auto">
            Initiate a secure password reset sequence. A cryptographic token will be dispatched to your owner inbox.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-8 shadow-2xl relative">
          
          {success ? (
            <div className="text-center animate-in zoom-in-95 duration-300 flex flex-col items-center space-y-5">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-2">Payload Dispatched</h3>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  If the credentials match an authorized owner, a recovery link has been transmitted.
                  <br /><br />
                  <span className="opacity-80">Check your inbox. (If no email provider is configured, check the server console).</span>
                </p>
                <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                  Return to gateway
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Owner Email
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    ref={emailRef}
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    placeholder="authorized@address.com"
                    className={`w-full bg-black/40 text-sm text-white placeholder-slate-600 pl-10 pr-4 py-3 outline-none rounded-xl border font-mono transition-all duration-200
                      ${error ? 'border-red-500/40 ring-2 ring-red-500/10' : 'border-white/[0.08] focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/10'}
                    `}
                    disabled={isLoading}
                  />
                </div>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm animate-in fade-in">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full flex items-center justify-center gap-2.5 bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25 px-6 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-violet-500/30"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cpu className="w-4 h-4" />}
                {isLoading ? 'Encrypting Payload…' : 'Generate Recovery Token'}
              </button>

              <div className="text-center pt-2">
                <Link href="/login" className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5">
                  <ChevronLeft className="w-3 h-3" />
                  Abort sequence
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
