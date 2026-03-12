"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function CheckIcon({ met }: { met: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${met ? "text-green-400" : "text-neutral-600"}`}
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      {met && (
        <path
          d="M5 8l2 2 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function SignupForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const supabase = createClient();

  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const passwordsMatch = password.length > 0 && confirmPassword === password;
  const allChecksMet = Object.values(checks).every(Boolean) && passwordsMatch;

  const showChecklist = password.length > 0;

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleOAuthLogin(provider: "google" | "facebook") {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { skipBrowserRedirect: true },
    });
    if (error) {
      setError(error.message);
      return;
    }

    const popup = window.open(data.url, `${provider}-auth`, "width=500,height=600");

    pollRef.current = setInterval(async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        if (pollRef.current) clearInterval(pollRef.current);
        popup?.close();
        router.push("/");
        router.refresh();
      }
    }, 500);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="font-display text-4xl tracking-wide">CREATE ACCOUNT</h1>
          <p className="text-neutral-500 text-sm mt-2 font-body">
            {message ?? "Join the debate on Top5DOA"}
          </p>
        </div>

        {/* OAuth Providers */}
        <div className="space-y-3">
          <button
            onClick={() => handleOAuthLogin("google")}
            className="w-full flex items-center justify-center gap-3 px-4 py-3
                       rounded-xl bg-white text-neutral-900 font-mono font-bold text-sm
                       hover:bg-neutral-100 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign up with Google
          </button>

          <button
            onClick={() => handleOAuthLogin("facebook")}
            className="w-full flex items-center justify-center gap-3 px-4 py-3
                       rounded-xl bg-[#1877F2] text-white font-mono font-bold text-sm
                       hover:bg-[#166FE5] transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Sign up with Facebook
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-brand-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-brand-bg px-4 text-neutral-600 font-mono">or</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label
              htmlFor="display-name"
              className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-1.5"
            >
              Display Name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-brand-surface border border-brand-border
                         text-white font-body placeholder-neutral-700 focus:outline-none focus:border-brand-accent/50
                         focus:ring-1 focus:ring-brand-accent/30 transition-colors"
              placeholder="Your display name"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-1.5"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-brand-surface border border-brand-border
                         text-white font-body placeholder-neutral-700 focus:outline-none focus:border-brand-accent/50
                         focus:ring-1 focus:ring-brand-accent/30 transition-colors"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-1.5"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-brand-surface border border-brand-border
                         text-white font-body placeholder-neutral-700 focus:outline-none focus:border-brand-accent/50
                         focus:ring-1 focus:ring-brand-accent/30 transition-colors"
              placeholder="••••••••"
            />
          </div>

          {/* Live password requirements checklist */}
          {showChecklist && (
            <div className="rounded-xl bg-brand-surface border border-brand-border px-4 py-3 space-y-2">
              <p className="text-xs font-mono text-neutral-500 uppercase tracking-wider mb-2">
                Password requirements
              </p>
              {[
                { met: checks.length, label: "At least 8 characters" },
                { met: checks.uppercase, label: "One uppercase letter" },
                { met: checks.number, label: "One number" },
                { met: checks.special, label: "One special character" },
              ].map(({ met, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <CheckIcon met={met} />
                  <span
                    className={`text-xs font-mono transition-colors ${met ? "text-green-400" : "text-neutral-500"}`}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-xs font-mono text-neutral-500 uppercase tracking-wider mb-1.5"
            >
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className={`w-full px-4 py-3 rounded-xl bg-brand-surface border font-body
                         text-white placeholder-neutral-700 focus:outline-none focus:ring-1 transition-colors
                         ${
                           confirmPassword.length > 0 && !passwordsMatch
                             ? "border-brand-red/60 focus:border-brand-red/60 focus:ring-brand-red/30"
                             : confirmPassword.length > 0 && passwordsMatch
                               ? "border-green-500/60 focus:border-green-500/60 focus:ring-green-500/30"
                               : "border-brand-border focus:border-brand-accent/50 focus:ring-brand-accent/30"
                         }`}
              placeholder="••••••••"
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="mt-1.5 text-xs font-mono text-brand-red">Passwords do not match</p>
            )}
          </div>

          {error && (
            <p className="text-brand-red text-sm font-mono">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !allChecksMet}
            className="w-full px-4 py-3 rounded-xl bg-brand-accent text-brand-bg font-mono font-bold
                       hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500 font-body">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-accent hover:underline font-mono">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
