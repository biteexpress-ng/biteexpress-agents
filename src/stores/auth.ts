import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AgentProfile } from "@/lib/api/types";

interface AuthState {
  token: string | null;
  agent: AgentProfile | null;
  /** True once persisted storage has been read — guards wait for this
   *  before deciding whether to redirect, to avoid a login flash. */
  hydrated: boolean;
  setSession: (token: string, agent: AgentProfile) => void;
  setAgent: (agent: AgentProfile) => void;
  clear: () => void;
  /** Internal — flipped by onRehydrateStorage once storage is read. */
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      agent: null,
      hydrated: false,
      setSession: (token, agent) => set({ token, agent }),
      setAgent: (agent) => set({ agent }),
      clear: () => set({ token: null, agent: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "bx-agent-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, agent: state.agent }),
      // Call the action off the rehydrated state — never reference the store
      // const here (it's still in its TDZ during synchronous hydration, and
      // the resulting error is swallowed inside zustand, leaving hydrated stuck
      // at false so every guarded route would hang on the loader).
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
