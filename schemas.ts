import { z } from "zod";

export const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
  stream: z.boolean().optional().default(true),
});

export const lmStudioOverridesSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  user: z.string().optional(),
  seed: z.number().int().optional(),
  response_format: z.object({
    type: z.enum(["text", "json_schema"]),
    json_schema: z.object({
      name: z.string().optional(),
      schema: z.record(z.unknown()).optional(),
      strict: z.boolean().optional(),
    }).optional(),
  }).optional(),
});

export const chatWithOverridesSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
  stream: z.boolean().optional().default(false),
  overrides: lmStudioOverridesSchema.optional(),
});

export const toolCallRequestSchema = z.object({
  action: z.string(),
  params: z.record(z.unknown()),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatWithOverridesRequest = z.infer<typeof chatWithOverridesSchema>;
export type LMStudioOverrides = z.infer<typeof lmStudioOverridesSchema>;
export type ToolCallRequest = z.infer<typeof toolCallRequestSchema>;
