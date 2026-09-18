import { z } from "zod";

const HTTPS_URL = z
  .string()
  .min(10)
  .max(512)
  .refine(url => url.startsWith("https://"), "URL must use HTTPS")
  .refine(url => !url.includes("@"), "URL must not contain credentials")
  .refine(url => !url.includes("#"), "URL must not contain fragment")
  .refine(url => {
    const privatePrefixes = [
      "https://localhost", "https://127.", "https://10.",
      "https://192.168.", "https://172.",
    ];
    return !privatePrefixes.some(p => url.startsWith(p));
  }, "URL must not target private/local address");

export const SourceSchema = z.object({
  url: HTTPS_URL,
  label: z.string().min(1).max(64),
});

export const CreateProfileSchema = z.object({
  project_name: z.string().min(1).max(128),
  description: z.string().min(10).max(512),
  sources: z
    .array(SourceSchema)
    .min(2, "At least 2 sources required")
    .max(4, "At most 4 sources allowed"),
});

export const BorrowSchema = z.object({
  profile_id: z.string().min(1),
  collateral_gen: z.string().refine(v => {
    try {
      const n = parseFloat(v);
      return n > 0 && isFinite(n);
    } catch {
      return false;
    }
  }, "Enter a valid positive amount"),
  principal_gen: z.string().refine(v => {
    try {
      const n = parseFloat(v);
      return n > 0 && isFinite(n);
    } catch {
      return false;
    }
  }, "Enter a valid positive amount"),
});

export const DepositSchema = z.object({
  amount_gen: z.string().refine(v => {
    try {
      const n = parseFloat(v);
      return n > 0 && isFinite(n);
    } catch {
      return false;
    }
  }, "Enter a valid positive amount"),
});
