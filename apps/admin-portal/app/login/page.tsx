/**
 * @purpose Public entry point for the Next admin portal — the only route `middleware.ts` allows without a
 *   Supabase Auth session. Everything else (Overview / Reports / Money / Soft-Wall / Profile / Features /
 *   People) redirects here first. A server component, so it can set the tab title ("Sign in · Tapua'i
 *   Admin" through the root layout template); the form itself is the client `LoginForm`.
 */
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginForm } from '@/components/LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-6 py-10">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
