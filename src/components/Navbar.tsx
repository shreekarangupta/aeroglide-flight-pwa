'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUserStore } from '@/stores/useUserStore';
import { useFlightStore } from '@/stores/useFlightStore';
import { createClient } from '@/lib/supabase/client';
import { Plane, LogOut, User, Menu, X, Ticket } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const { session, setSession, resetUserStore } = useUserStore();
  const { resetFlightStore } = useFlightStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync auth state on mount and changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (currentSession?.user) {
        setSession({
          id: currentSession.user.id,
          email: currentSession.user.email || '',
        });
      } else {
        setSession(null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (currentSession?.user) {
        setSession({
          id: currentSession.user.id,
          email: currentSession.user.email || '',
        });
      } else {
        setSession(null);
        resetFlightStore();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, setSession, resetFlightStore]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    resetUserStore();
    resetFlightStore();
    router.push('/');
  };

  const navLinks = [
    { name: 'Search Flights', href: '/' },
    { name: 'My Bookings', href: '/bookings', requiresAuth: true },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-md text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 p-2 text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
                <Plane className="h-5 w-5 -rotate-45" />
              </div>
              <span className="bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
                AeroGlide
              </span>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex md:items-center md:gap-6">
            {navLinks.map((link) => {
              if (link.requiresAuth && !session) return null;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`text-sm font-medium transition-colors duration-200 hover:text-indigo-400 ${
                    isActive ? 'text-indigo-400 border-b-2 border-indigo-500 pb-1 mt-0.5' : 'text-slate-300'
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </div>

          {/* Auth Button (Desktop) */}
          <div className="hidden md:flex md:items-center md:gap-4">
            {session ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-3.5 py-1.5 text-xs text-slate-300">
                  <User className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="max-w-[120px] truncate">{session.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 transition-all duration-200"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition-all duration-200 hover:scale-[1.02]"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white focus:outline-none transition-colors"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/10 bg-slate-950 px-4 py-4 space-y-3">
          {navLinks.map((link) => {
            if (link.requiresAuth && !session) return null;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block rounded-xl px-4 py-2.5 text-base font-medium transition-colors ${
                  isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {link.name}
              </Link>
            );
          })}

          {session ? (
            <div className="pt-4 border-t border-white/10 space-y-3">
              <div className="flex items-center gap-2 px-4 py-1.5 text-sm text-slate-400">
                <User className="h-4 w-4 text-indigo-400" />
                <span className="truncate">{session.email}</span>
              </div>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 py-2.5 text-base font-medium text-red-400 hover:bg-red-500/20 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-center rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-base font-medium text-white shadow-lg shadow-indigo-500/25"
            >
              Sign In
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
