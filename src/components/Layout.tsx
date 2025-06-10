import { AppNavigation } from "@/components/AppNavigation";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <AppNavigation>
      {children}
    </AppNavigation>
  );
}
