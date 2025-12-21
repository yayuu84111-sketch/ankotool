import { z } from "zod";

export const captureSchema = z.object({
  id: z.number(),
  imageData: z.string(),
  createdAt: z.date(),
});

export const insertCaptureSchema = z.object({
  imageData: z.string(),
});

export type Capture = z.infer<typeof captureSchema>;
export type InsertCapture = z.infer<typeof insertCaptureSchema>;
