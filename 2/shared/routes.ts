import { z } from "zod";
import { insertCaptureSchema, captures } from "./schema";

export const api = {
  captures: {
    create: {
      method: "POST" as const,
      path: "/api/captures",
      input: insertCaptureSchema,
      responses: {
        201: z.custom<typeof captures.$inferSelect>(),
        400: z.object({ message: z.string() }),
      },
    },
    list: {
      method: "GET" as const,
      path: "/api/captures",
      responses: {
        200: z.array(z.custom<typeof captures.$inferSelect>()),
        401: z.object({ message: z.string() }),
      },
    },
  },
  auth: {
    login: {
      method: "POST" as const,
      path: "/api/auth/login",
      input: z.object({ password: z.string() }),
      responses: {
        200: z.object({ success: z.boolean() }),
        401: z.object({ message: z.string() }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
