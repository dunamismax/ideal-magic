"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import { IconButton } from "@/components/ui/icon-button";

type Theme = "dark" | "light";

const themeStorageKey = "pod-tracker-theme";
const lightPreferenceQuery = "(prefers-color-scheme: light)";
const themeChangeEvent = "pod-tracker-theme-change";

function isTheme(value: string | null): value is Theme {
  return value === "dark" || value === "light";
}

function getStoredTheme() {
  try {
    const storedTheme = window.localStorage.getItem(themeStorageKey);

    return isTheme(storedTheme) ? storedTheme : null;
  } catch {
    return null;
  }
}

function getPreferredTheme(): Theme {
  const storedTheme = getStoredTheme();

  if (storedTheme) {
    return storedTheme;
  }

  return window.matchMedia?.(lightPreferenceQuery).matches ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function setAppliedTheme(theme: Theme) {
  applyTheme(theme);
  window.dispatchEvent(new Event(themeChangeEvent));
}

function persistTheme(theme: Theme) {
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Theme still applies for the current page even if storage is unavailable.
  }
}

function getAppliedTheme(): Theme {
  const appliedTheme = document.documentElement.dataset.theme ?? null;

  return isTheme(appliedTheme) ? appliedTheme : getPreferredTheme();
}

function subscribeTheme(onThemeChange: () => void) {
  const mediaQuery = window.matchMedia?.(lightPreferenceQuery);

  function syncSystemPreference() {
    if (getStoredTheme() || !mediaQuery) {
      return;
    }

    applyTheme(mediaQuery.matches ? "light" : "dark");
    onThemeChange();
  }

  window.addEventListener(themeChangeEvent, onThemeChange);
  mediaQuery?.addEventListener("change", syncSystemPreference);

  return () => {
    window.removeEventListener(themeChangeEvent, onThemeChange);
    mediaQuery?.removeEventListener("change", syncSystemPreference);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getAppliedTheme,
    () => "dark",
  );

  useEffect(() => {
    setAppliedTheme(getPreferredTheme());
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const label =
    nextTheme === "light" ? "Switch to light mode" : "Switch to dark mode";
  const Icon = nextTheme === "light" ? Sun : Moon;

  return (
    <IconButton
      aria-pressed={theme === "dark"}
      label={label}
      onClick={() => {
        persistTheme(nextTheme);
        setAppliedTheme(nextTheme);
      }}
      variant="secondary"
    >
      <Icon className="size-4" aria-hidden="true" />
    </IconButton>
  );
}
