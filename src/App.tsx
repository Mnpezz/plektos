// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Layout } from "@/components/Layout";
import AppRouter from "./AppRouter";
import { ThemeProvider } from "@/components/theme-provider";

const queryClient = new QueryClient();

export function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="plektos-theme">
      <QueryClientProvider client={queryClient}>
        <Layout>
          <AppRouter />
        </Layout>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
