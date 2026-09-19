import { Suspense } from 'react';

import { LoginForm } from '@/components/LoginForm';

/**
 * @purpose Public entry point for the Next admin portal — the only route `middleware.ts` allows without a
 *   Supabase Auth session. Everything else (Overview / Reports / Money / Soft-Wall / Profile / Features /
 *   People) redirects here first.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-6 py-10">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
