import { createContext } from "react";

export type Theme = "dark" | "light" | "system";

export type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeContextType = {
  theme: "system",
  setTheme: () => undefined,
};

export const ThemeContext = createContext<ThemeContextType>(initialState);