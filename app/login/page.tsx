'use client';

import React, { useState, useRef, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Lock, Eye, EyeOff, Cpu, ShieldCheck,
  Zap, Layers, AlertCircle, ArrowRight, Loader2,
} from 'lucide-react';

// ── Animated background particles ────────────────────────────────────────────
function Particle({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="absolute rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 blur-xl animate-pulse pointer-events-none"
      style={style}
    />
  );
}

const PARTICLES = [
  { width: 320, height: 320, top: '5%',  left: '-8%',  animationDelay: '0s',    animationDuration: '6s'  },
  { width: 240, height: 240, top: '60%', right: '-6%', animationDelay: '2s',    animationDuration: '8s'  },
  { width: 180, height: 180, top: '40%', left: '60%',  animationDelay: '1s',    animationDuration: '7s'  },
  { width: 120, height: 120, top: '80%', left: '20%',  animationDelay: '3.5s',  animationDuration: '5s'  },
];

// ── Feature badges ────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <ShieldCheck className="w-4 h-4" />,
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400',
    label: 'Owner-Only Access',
    desc: 'Private, single-owner authentication with bcrypt-secured credentials.',
  },
  {
    icon: <Zap className="w-4 h-4" />,
    color: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400',
    label: 'AI Generation Engine',
    desc: 'Multi-model pipeline: Parse → Generate → Validate → Preview.',
  },
  {
    icon: <Layers className="w-4 h-4" />,
    color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400',
    label: 'WCAG 2.1 AA Built-in',
    desc: 'Every component auto-validated for accessibility compliance.',
  },
  {
    icon: <Cpu className="w-4 h-4" />,
    color: 'from-violet-500/20 to-purple-500/20 border-violet-500/30 text-violet-400',
    label: 'Any LLM Provider',
    desc: 'OpenAI, Anthropic, Google, Groq, Ollama — all provider-agnostic.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [shakeCard,   setShakeCard]   = useState(false);
  const [focusField,  setFocusField]  = useState<'email' | 'password' | null>(null);

  // Focus email on mount
  useEffect(() => { emailRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Both fields are required.');
      triggerShake();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email:    email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid credentials. Access denied.');
        triggerShake();
        setPassword('');
      } else if (result?.ok) {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('Authentication service unavailable. Try again.');
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const triggerShake = () => {
    setShakeCard(true);
    setTimeout(() => setShakeCard(false), 600);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 overflow-hidden relative selection:bg-blue-500/30">
      {/* Animated background particles */}
      {PARTICLES.map((p, i) => (
        <Particle
          key={i}
          style={{
            width:             p.width,
            height:            p.height,
            top:               p.top,
            left:              (p as { left?: string }).left,
            right:             (p as { right?: string }).right,
            animationDelay:    p.animationDelay,
            animationDuration: p.animationDuration,
          }}
        />
      ))}

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#818cf8 1px, transparent 1px), linear-gradient(90deg, #818cf8 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="w-full max-w-[460px] z-10 relative">

        {/* ── Brand Header ──────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          {/* Animated logo mark */}
          <div className="inline-flex items-center justify-center mb-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-[1.5px] shadow-2xl shadow-blue-500/30">
                <div className="w-full h-full bg-gray-950 rounded-[14px] flex items-center justify-center">
                  <Cpu className="w-8 h-8 text-blue-400" />
                </div>
              </div>
              {/* Orbiting dot */}
              <div
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 border-2 border-gray-950 shadow-lg shadow-emerald-500/40"
                style={{ animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite' }}
              />
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 border-2 border-gray-950" />
            </div>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight mb-2">
            <span className="block text-sm font-semibold text-indigo-400 uppercase tracking-widest mb-2">
              Owner Access
            </span>
            AI&nbsp;
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400">
              UI Engine
            </span>
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed max-w-[320px] mx-auto">
            This workspace is private. Authenticate with your owner credentials to access the generation engine.
          </p>
        </div>

        {/* ── Login Card ────────────────────────────────────────────────── */}
        <div
          className={`
            relative bg-gray-900/50 backdrop-blur-2xl border rounded-3xl p-8 shadow-2xl
            transition-all duration-300
            ${shakeCard
              ? 'border-red-500/50 shadow-red-500/10'
              : 'border-gray-800/60 shadow-black/40'
            }
          `}
          style={shakeCard ? { animation: 'shake 0.5s ease-in-out' } : {}}
        >
          {/* Subtle top highlight */}
          <div className="absolute inset-x-0 top-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* Email field */}
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Owner Email
              </label>
              <div className={`
                relative flex items-center rounded-xl border bg-gray-800/50 transition-all duration-200
                ${focusField === 'email'
                  ? 'border-blue-500/60 ring-3 ring-blue-500/10 bg-gray-800/70'
                  : error
                  ? 'border-red-500/40'
                  : 'border-gray-700/60 hover:border-gray-600/60'
                }
              `}>
                <Lock className="absolute left-3.5 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  ref={emailRef}
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                  onFocus={() => setFocusField('email')}
                  onBlur={() => setFocusField(null)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-600 pl-10 pr-4 py-3 outline-none rounded-xl font-mono"
                  disabled={isLoading}
                  aria-describedby={error ? 'login-error' : undefined}
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Access Password
              </label>
              <div className={`
                relative flex items-center rounded-xl border bg-gray-800/50 transition-all duration-200
                ${focusField === 'password'
                  ? 'border-indigo-500/60 ring-3 ring-indigo-500/10 bg-gray-800/70'
                  : error
                  ? 'border-red-500/40'
                  : 'border-gray-700/60 hover:border-gray-600/60'
                }
              `}>
                <Lock className="absolute left-3.5 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  onFocus={() => setFocusField('password')}
                  onBlur={() => setFocusField(null)}
                  placeholder="••••••••••••"
                  className="w-full bg-transparent text-sm text-gray-100 placeholder-gray-600 pl-10 pr-12 py-3 outline-none rounded-xl font-mono tracking-widest"
                  disabled={isLoading}
                  aria-describedby={error ? 'login-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3.5 p-1 text-gray-500 hover:text-gray-300 transition-colors rounded-md focus-visible:ring-2 focus-visible:ring-indigo-500"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div
                id="login-error"
                role="alert"
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                {error}
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              id="login-submit"
              className={`
                w-full relative flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl
                font-bold text-sm transition-all duration-200
                focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950
                ${isLoading || !email || !password
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700/50'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.98] border border-blue-500/30'
                }
              `}
              aria-busy={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  Access Engine
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
              {/* Shimmer overlay */}
              {!isLoading && email && password && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/0 via-white/5 to-white/0 pointer-events-none" />
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-800/60" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-[11px] font-semibold text-gray-600 uppercase tracking-widest bg-gray-900/50">
                Capabilities
              </span>
            </div>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className={`
                  flex items-start gap-2.5 p-3 rounded-xl border
                  bg-gradient-to-br ${f.color} transition-all duration-200
                  hover:scale-[1.02] cursor-default
                `}
              >
                <div className={`mt-0.5 shrink-0 ${f.color.split(' ').find(c => c.startsWith('text'))}`}>
                  {f.icon}
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-200 leading-tight">{f.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-gray-700">
          Restricted to authorised personnel only.&nbsp;
          <span className="text-gray-600">v1.0 · AI UI Engine</span>
        </p>
      </div>

      {/* Shake + ring keyframes */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(8px); }
          45%       { transform: translateX(-6px); }
          60%       { transform: translateX(6px); }
          75%       { transform: translateX(-4px); }
          90%       { transform: translateX(4px); }
        }
        .ring-3 { --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color); --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(3px + var(--tw-ring-offset-width)) var(--tw-ring-color); box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000); }
      `}</style>
    </div>
  );
}
