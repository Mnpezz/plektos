import { Link, useLocation } from "react-router-dom";
import { Search, Plus, Ticket, User } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { LoginArea } from "@/components/auth/LoginArea";
import { AccountSwitcher } from "@/components/auth/AccountSwitcher";
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
                    <item.icon className="h-5 w-5" />
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
  const MobileBottomNav = () => (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t md:hidden">
      <nav className="flex items-center justify-around py-2 px-4">
        {navigationItems.map((item) => {
          if (item.requireAuth && !user) return null;

          return (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              className={cn(
                "flex flex-col items-center gap-1 h-auto py-3 px-4",
                item.isActive && "text-primary bg-primary/10"
              )}
              asChild
            >
              <Link to={item.href} onClick={item.onClick}>
                <item.icon className="h-6 w-6 scale-125" />
              </Link>
            </Button>
          );
        })}

        {/* Direct LoginArea integration - no modal */}
        <div className="flex items-center py-2 px-3">
          <div className="hidden md:block">
            <LoginArea className="flex items-center [&_button]:h-8 [&_button]:w-8 [&_img]:h-6 [&_img]:w-6 [&_svg]:h-4 [&_svg]:w-4" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex flex-col items-center gap-1 h-auto py-3 px-4 md:hidden"
              >
                <User className="h-6 w-6 scale-125" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
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

  return (
    <>
      {isMobile ? (
        // Mobile layout - no sidebar, just content with bottom nav
        <div className="min-h-screen bg-background pb-16">
          {/* Mobile header */}
          <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center">
              <Link to="/" className="flex items-center space-x-2">
                <img src="/icon.svg" alt="Plektos" className="h-6 w-6" />
                <span className="font-bold">Plektos</span>
              </Link>
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
                    {/* Additional header items */}
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
