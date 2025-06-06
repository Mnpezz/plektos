// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import {
  ChevronDown,
  LogOut,
  UserIcon,
  UserPlus,
  Moon,
  Sun,
  Monitor,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu.tsx";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar.tsx";
import { useLoggedInAccounts, type Account } from "@/hooks/useLoggedInAccounts";
import { genUserName } from "@/lib/genUserName";
import { useTheme } from "@/components/theme-provider";
import { nip19 } from "nostr-tools";
import { Link } from "react-router-dom";

interface AccountSwitcherProps {
  onAddAccountClick: () => void;
}

export function AccountSwitcher({ onAddAccountClick }: AccountSwitcherProps) {
  const { currentUser, otherUsers, setLogin, removeLogin } =
    useLoggedInAccounts();
  const { setTheme } = useTheme();

  if (!currentUser) return null;

  const getDisplayName = (account: Account): string =>
    account.metadata.name ?? genUserName(account.pubkey);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 p-3 rounded-full hover:bg-accent transition-all w-full text-foreground">
          <Avatar className="w-10 h-10">
            <AvatarImage
              src={currentUser.metadata.picture}
              alt={getDisplayName(currentUser)}
            />
            <AvatarFallback>
              {getDisplayName(currentUser).charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 text-left hidden md:block truncate">
            <p className="font-medium text-sm truncate">
              {getDisplayName(currentUser)}
            </p>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 p-2 animate-scale-in">
        <div className="font-medium text-sm px-2 py-1.5">Switch Account</div>
        {otherUsers.map((user) => (
          <DropdownMenuItem
            key={user.id}
            onClick={() => setLogin(user.id)}
            className="flex items-center gap-2 cursor-pointer p-2 rounded-md"
          >
            <Avatar className="w-8 h-8">
              <AvatarImage
                src={user.metadata.picture}
                alt={getDisplayName(user)}
              />
              <AvatarFallback>
                {getDisplayName(user)?.charAt(0) || <UserIcon />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium">{getDisplayName(user)}</p>
            </div>
            {user.id === currentUser.id && (
              <div className="w-2 h-2 rounded-full bg-primary"></div>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onAddAccountClick}
          className="flex items-center gap-2 cursor-pointer p-2 rounded-md"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add another account</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer p-2 rounded-md">
          <Link
            to={`/profile/${nip19.npubEncode(currentUser.pubkey)}`}
            className="flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer p-2 rounded-md">
            <Sun className="w-4 h-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute w-4 h-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span>Theme</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="w-4 h-4 mr-2" />
              <span>Light</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="w-4 h-4 mr-2" />
              <span>Dark</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="w-4 h-4 mr-2" />
              <span>System</span>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          onClick={() => removeLogin(currentUser.id)}
          className="flex items-center gap-2 cursor-pointer p-2 rounded-md text-red-500"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
