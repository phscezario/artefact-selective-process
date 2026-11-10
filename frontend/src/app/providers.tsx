'use client';

import { TRPCReactProvider } from '@/lib/trpc/client';
import { ToastProvider } from '@/components/toast';

/**
 * Client boundary of the app: the tRPC/React Query provider plus the toast host.
 * Keeping it in a single component means the root layout can stay a server component.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <ToastProvider>{children}</ToastProvider>
    </TRPCReactProvider>
  );
}
