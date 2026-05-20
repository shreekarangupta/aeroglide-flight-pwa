'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/useUserStore';
import { Plane, Mail, Lock, Loader2, Sparkles } from 'lucide-react';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { session, setSession } = useUserStore();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // If already logged in, redirect away
  useEffect(() => {
    if (session) {
      const redirect = searchParams.get('redirect') || '/';
      router.push(redirect);
    }
  }, [session, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        setMessage({
          type: 'success',
          text: 'Account created! If email confirmation is enabled, check your inbox to confirm your registration. Otherwise, you can sign in directly.',
        });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.session?.user) {
          setSession({
            id: data.session.user.id,
            email: data.session.user.email || '',
          });
          setMessage({ type: 'success', text: 'Logged in successfully! Redirecting...' });
          
          const redirect = searchParams.get('redirect') || '/';
          setTimeout(() => {
            router.push(redirect);
          }, 1000);
        }
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'Authentication failed. Please check credentials.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center pt-8 pb-16 animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/60 p-6 md:p-8 backdrop-blur-md shadow-xl shadow-indigo-500/5 relative overflow-hidden">
        {/* Logo and header */}
        <div className="text-center mb-8 relative">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 p-2.5 text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center mb-4">
            <Plane className="h-6 w-6 -rotate-45" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            {isSignUp ? 'Create your account' : 'Sign in to AeroGlide'}
          </h2>
          <p className="text-xs text-slate-400 mt-1.5">
            {isSignUp ? 'Start booking tickets and managing seat charts' : 'Access your flight details and schedules'}
          </p>
        </div>

        {/* Status Messages */}
        {message && (
          <div
            className={`rounded-xl border p-4 text-xs font-medium leading-relaxed mb-6 ${
              message.type === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-indigo-400" />
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-all duration-200"
            />
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-indigo-400" />
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none transition-all duration-200"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:scale-[1.01] transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : isSignUp ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-6 text-center text-xs">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage(null);
            }}
            className="text-slate-400 hover:text-indigo-400 transition-colors font-medium"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
