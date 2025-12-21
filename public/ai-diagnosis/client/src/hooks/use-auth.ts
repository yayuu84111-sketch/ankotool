import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

export function useLogin() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (password: string) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error("Invalid password");
        throw new Error("Login failed");
      }

      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      // Invalidate captures query so it retries fetching with the new auth state
      queryClient.invalidateQueries({ queryKey: [api.captures.list.path] });
    },
  });
}
