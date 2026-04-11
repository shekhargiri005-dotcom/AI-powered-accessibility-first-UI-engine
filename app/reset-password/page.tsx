'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, Loader2, CheckCircle2, ChevronLeft, Eye, EyeOff, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const passwordRef = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass1, setShowPass1] = useState(false);
  const [showPass2, setShowPass2] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus on mount
  useEffect(() => { passwordRef.current?.focus(); }, []);

  // Validate token/email presence
  useEffect(() => {
    if (!token || !email) {
      setError('Invalid or missing recovery token. Please initiate the recovery sequence again.');
    }
  }, [token, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !email) return;

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(),
          token,
          newPassword: password
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to construct new cryptographic hash.');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Transmission error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center animate-in zoom-in-95 duration-300 flex flex-col items-center space-y-5">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Hash Successfully Rewritten</h3>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            Your owner credentials have been securely updated in the database using strong bcrypt hashing.
          </p>
          <Link href="/login" className="inline-flex items-center justify-center w-full bg-violet-600 hover:bg-violet-500 text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-violet-500/25 border border-violet-500/30">
            Return to Gateway
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="new-password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
          New Access Password
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
          <input
            ref={passwordRef}
            id="new-password"
            type={showPass1 ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            placeholder="••••••••••••"
            className="w-full bg-black/40 text-sm text-white placeholder-slate-600 pl-10 pr-12 py-3 outline-none rounded-xl border border-white/[0.08] focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/10 tracking-widest font-mono transition-all duration-200"
            disabled={isLoading || !token}
          />
          <button
            type="button"
            onClick={() => setShowPass1(p => !p)}
            className="absolute right-3.5 top-3.5 p-0.5 text-slate-500 hover:text-slate-300 transition-colors rounded-md"
            tabIndex={-1}
          >
            {showPass1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirm-password" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Confirm Password
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
          <input
            id="confirm-password"
            type={showPass2 ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
            placeholder="••••••••••••"
            className="w-full bg-black/40 text-sm text-white placeholder-slate-600 pl-10 pr-12 py-3 outline-none rounded-xl border border-white/[0.08] focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/10 tracking-widest font-mono transition-all duration-200"
            disabled={isLoading || !token}
          />
          <button
            type="button"
            onClick={() => setShowPass2(p => !p)}
            className="absolute right-3.5 top-3.5 p-0.5 text-slate-500 hover:text-slate-300 transition-colors rounded-md"
            tabIndex={-1}
          >
            {showPass2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span className="leading-snug">{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading || !token || !email || !password || !confirmPassword}
        className="w-full flex items-center justify-center gap-2.5 bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25 px-6 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-violet-500/30 mt-2"
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
        {isLoading ? 'Hashing Protocol…' : 'Initialize New Password'}
      </button>

      <div className="text-center pt-2">
        <Link href="/login" className="text-xs text-slate-500 hover:text-slate-300 transition-colors inline-flex items-center gap-1.5">
          <ChevronLeft className="w-3 h-3" />
          Abort sequence
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[#0B0F19] flex flex-col items-center justify-center p-4 relative selection:bg-violet-500/30">
      
      {/* Background decorations */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
      </div>

      <div className="w-full max-w-[420px] z-10 relative space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 mb-2">
            <KeyRound className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Identity Verified</h1>
          <p className="text-sm text-slate-400 max-w-[300px] mx-auto">
            Construct a new bcrypt-secured password hash to regain owner access.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-3xl p-8 shadow-2xl relative">
          <Suspense fallback={<div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
