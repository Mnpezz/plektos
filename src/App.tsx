// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { Suspense } from 'react';
import NostrProvider from '@/components/NostrProvider'
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { Spinner } from '@/components/ui/spinner';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NostrLoginProvider } from '@nostrify/react/login';
import AppRouter from './AppRouter';

// DO NOT MODIFY THIS RELAY LIST UNLESS EXPLICITLY REQUESTED
const defaultRelays = [
  'wss://ditto.pub/relay',
  // DO NOT ADD ANY RELAY WITHOUT FIRST USING A TOOL TO VERIFY IT IS ONLINE AND FUNCTIONAL
  // IF YOU CANNOT VERIFY A RELAY IS ONLINE AND FUNCTIONAL, DO NOT ADD IT HERE
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      gcTime: Infinity,
    },
  },
});

export function App() {
  return (
    <ThemeProvider defaultTheme="system">
      <NostrLoginProvider storageKey='nostr:login'>
        <NostrProvider relays={defaultRelays}>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <Suspense fallback={<div className="flex items-center justify-center h-screen"><Spinner /></div>}>
                <AppRouter />
              </Suspense>
            </TooltipProvider>
          </QueryClientProvider>
        </NostrProvider>
      </NostrLoginProvider>
    </ThemeProvider>
  );
}

export default App;
