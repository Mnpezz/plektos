import { Link, useLocation } from "react-router-dom";
import { Search, Plus, Ticket, User } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { LoginArea } from "@/components/auth/LoginArea";
import { AccountSwitcher } from "@/components/auth/AccountSwitcher";
import { NotificationBell } from "@/components/NotificationBell";
import LoginDialog from "@/components/auth/LoginDialog";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";

interface AppNavigationProps {
  children: React.ReactNode;
}

export function AppNavigation({ children }: AppNavigationProps) {
  const { user } = useCurrentUser();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);

  const handleDiscoverClick = (e: React.MouseEvent) => {
    if (location.pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleLogin = () => {
    setLoginDialogOpen(false);
  };

  const navigationItems = [
    {
      href: "/",
      label: "Discover",
      icon: Search,
      isActive: location.pathname === "/",
      onClick: handleDiscoverClick,
    },
    {
      href: "/create",
      label: "Create",
      icon: Plus,
      isActive: location.pathname === "/create",
      requireAuth: true,
    },
    {
      href: "/tickets",
      label: "Tickets",
      icon: Ticket,
      isActive: location.pathname === "/tickets",
      requireAuth: true,
    },
  ];

  // Desktop sidebar navigation
  const DesktopSidebar = () => (
    <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-2 py-1">
          <img src="/icon.svg" alt="Plektos" className="h-8 w-8" />
          <span className="font-bold text-lg">Plektos</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="p-2">
          {navigationItems.map((item) => {
            if (item.requireAuth && !user) return null;

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={item.isActive} size="lg">
                  <Link to={item.href} onClick={item.onClick}>
                    <item.icon className="!h-6 !w-6 !min-h-6 !min-w-6" />
                    <span className="text-base">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        {/* Account section */}
        <div className="mt-auto p-4 border-t">
          <LoginArea className="flex w-full" />
        </div>
      </SidebarContent>
    </Sidebar>
  );

  // Mobile bottom navigation
  const MobileBottomNav = () => {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
        <nav className="flex items-center h-16 px-2">
          {/* Create a grid-like layout for even spacing */}
          <div className="flex items-center justify-between w-full max-w-sm mx-auto">
            {navigationItems.map((item) => {
              if (item.requireAuth && !user) return null;

              return (
                <Button
                  key={item.href}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 h-12 w-14 p-0 rounded-lg",
                    item.isActive && "text-primary bg-primary/10"
                  )}
                  asChild
                >
                  <Link to={item.href} onClick={item.onClick}>
                    <item.icon className="!h-6 !w-6 !min-h-6 !min-w-6" />
                  </Link>
                </Button>
              );
            })}

            {/* User/Account button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex flex-col items-center justify-center gap-1 h-16 w-16 p-0 rounded-lg"
                >
                  <User className="!h-6 !w-6 !min-h-6 !min-w-6" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mb-2">
                <div className="md:hidden">
                  <AccountSwitcher
                    onAddAccountClick={() => setLoginDialogOpen(true)}
                    variant="menu"
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </div>
    );
  };

  return (
    <>
      {isMobile ? (
        // Mobile layout - no sidebar, just content with bottom nav
        <div className="min-h-screen bg-background pb-16">
          {/* Mobile header */}
          <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center justify-between">
              <Link to="/" className="flex items-center space-x-2">
                <img src="/icon.svg" alt="Plektos" className="h-8 w-8" />
                <span className="font-bold text-lg">Plektos</span>
              </Link>
              {user && <NotificationBell className="!h-6 !w-6" />}
            </div>
          </header>

          <main className="container py-6">{children}</main>
          <MobileBottomNav />
        </div>
      ) : (
        // Desktop layout with sidebar
        <SidebarProvider defaultOpen={true}>
          <div className="flex min-h-screen w-full">
            <DesktopSidebar />
            <div className="flex-1">
              {/* Desktop header */}
              <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center justify-end">
                  {/* Search or other header content can go here */}
                  <div className="flex items-center space-x-2">
                    {user && <NotificationBell />}
                  </div>
                </div>
              </header>

              <main className="container py-6">{children}</main>
            </div>
          </div>
        </SidebarProvider>
      )}

      <LoginDialog
        isOpen={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
        onLogin={handleLogin}
      />
    </>
  );
}
