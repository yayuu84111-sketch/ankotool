import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertCapture } from "@shared/routes";

export function useCaptures() {
  return useQuery({
    queryKey: [api.captures.list.path],
    queryFn: async () => {
      const res = await fetch(api.captures.list.path);
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) throw new Error("Failed to fetch captures");
      return api.captures.list.responses[200].parse(await res.json());
    },
    // Don't retry on 401, let the UI handle redirect
    retry: (failureCount, error) => {
      if (error.message === "Unauthorized") return false;
      return failureCount < 3;
    },
  });
}

export function useCreateCapture() {
  return useMutation({
    mutationFn: async (data: InsertCapture) => {
      const res = await fetch(api.captures.create.path, {
        method: api.captures.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        throw new Error("Failed to create capture");
      }
      return api.captures.create.responses[201].parse(await res.json());
    },
  });
}
