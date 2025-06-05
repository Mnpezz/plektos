import { Link } from "react-router-dom";
import { LoginArea } from "@/components/auth/LoginArea";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user } = useCurrentUser();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <Link to="/" className="mr-8 sm:mr-10 flex items-center space-x-2">
              <img src="/icon.svg" alt="Plektos" className="h-6 w-6" />
              <span className="font-bold">Plektos</span>
            </Link>
            <nav className="flex items-center space-x-4 sm:space-x-6 text-sm font-medium">
              <Link
                to="/"
                className="transition-colors hover:text-foreground/80"
              >
                Discover
              </Link>
              {user && (
                <Link
                  to="/create"
                  className="transition-colors hover:text-foreground/80"
                >
                  Create
                </Link>
              )}
            </nav>
          </div>
          <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
            <div className="w-full flex-1 md:w-auto md:flex-none">
              {/* Add search or other header content here */}
            </div>
            <nav className="flex items-center space-x-2">
              <LoginArea />
            </nav>
          </div>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}
