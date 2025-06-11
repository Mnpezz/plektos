import { useEffect } from "react";
import { useTheme } from "@/components/theme-provider";

export function ThemeColorMeta() {
  const { theme } = useTheme();

  useEffect(() => {
    // Get the computed background color from CSS variables
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    const backgroundColor = computedStyle
      .getPropertyValue("--background")
      .trim();

    // Convert HSL to RGB
    const [h, s, l] = backgroundColor.split(" ").map(Number);
    const rgb = hslToRgb(h, s, l);

    // Update the theme-color meta tag
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", rgb);
    }
  }, [theme]);

  return null;
}

// Helper function to convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): string {
  // Convert percentages to decimals
  s = s / 100;
  l = l / 100;

  // Calculate intermediate values
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  // Calculate RGB values
  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  // Convert to 0-255 range and round
  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return `rgb(${r}, ${g}, ${b})`;
}
