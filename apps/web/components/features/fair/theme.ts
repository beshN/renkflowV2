import { useEffect } from "react";

/** The configurator has its own light look; the dashboard's dark mode must not leak into it. */
export function useFairLightTheme() {
  useEffect(() => {
    const html = document.documentElement;
    const wasDark = html.classList.contains("dark");
    html.classList.remove("dark");
    return () => {
      if (wasDark) html.classList.add("dark");
    };
  }, []);
}
