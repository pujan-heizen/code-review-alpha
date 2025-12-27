import { z } from "zod";

export const FixSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  filePath: z.string().min(1).describe("Workspace-relative file path."),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  replacement: z.string(),
  // Use null when not provided (Responses JSON schema requires required fields).
  expectedOriginalSnippet: z.string().nullable(),
});

export const FindingSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low"]),
  title: z.string().min(1),
  filePath: z.string().nullable(),
  startLine: z.union([z.number().int().positive(), z.null()]),
  endLine: z.union([z.number().int().positive(), z.null()]),
  rationale: z.string().nullable(),
});

export const ReviewOutputSchema = z.object({
  reviewMarkdown: z.string(),
  findings: z.array(FindingSchema),
  fixes: z.array(FixSchema),
});

export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;
export type Fix = z.infer<typeof FixSchema>;
