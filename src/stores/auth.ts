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
    }),
    {
      name: "bx-agent-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, agent: state.agent }),
      onRehydrateStorage: () => (state) => {
        // Fires after the rehydration attempt (even when storage is empty).
        useAuthStore.setState({ hydrated: true });
        void state;
      },
    },
  ),
);
