import { Link } from "react-router-dom";
import { LoginArea } from "@/components/auth/LoginArea";
import { Calendar, Home, Plus } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          {/* Logo/Brand */}
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold">Zather</span>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link
              to="/"
              className="flex items-center gap-2 transition-colors hover:text-foreground/80"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            <Link
              to="/events"
              className="flex items-center gap-2 transition-colors hover:text-foreground/80"
            >
              <Calendar className="h-4 w-4" />
              Events
            </Link>
            <Link
              to="/create"
              className="flex items-center gap-2 transition-colors hover:text-foreground/80"
            >
              <Plus className="h-4 w-4" />
              Create Event
            </Link>
          </nav>

          {/* Login Area - Pushed to the right */}
          <div className="ml-auto flex items-center space-x-4">
            <LoginArea />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-6">{children}</main>
    </div>
  );
}
