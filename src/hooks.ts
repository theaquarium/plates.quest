import { useEffect, useState } from "react";
import { loadState, subscribeToState, type LocalState } from "./lib/store";
import { getSyncState, subscribeToSync, type SyncState } from "./lib/sync";

export function useLocalState(): LocalState {
  const [state, setState] = useState(loadState);
  useEffect(() => subscribeToState(() => setState(loadState())), []);
  return state;
}

export function useSyncState(): SyncState {
  const [state, setState] = useState(getSyncState);
  useEffect(() => subscribeToSync(() => setState(getSyncState())), []);
  return state;
}

export function usePathname(): string {
  const [pathname, setPathname] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", update);
    window.addEventListener("plates-quest:navigate", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("plates-quest:navigate", update);
    };
  }, []);
  return pathname;
}

export function navigate(path: string): void {
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("plates-quest:navigate"));
  window.scrollTo({ top: 0, behavior: "instant" });
}
