import type { BaseConfig } from "@chatbotx.io/sdk"
import { customAuthSchema } from "@chatbotx.io/sdk"
import { z } from "zod"

export type EvolutionWhatsappConfig = BaseConfig & {
  /** Evolution API instance name -- denormalized onto
   * IntegrationEvolutionWhatsapp.instanceName at connect time for webhook
   * routing (see apps/worker/src/services/integrations.ts). */
  instanceName?: string
}

// Bintang self-hosts one Evolution API server per environment (not a
// shared OAuth app across many workspaces) -- customAuthSchema, no
// platform credential, same pattern as smtp/webchat/telegram.
export const evolutionWhatsappAuthSchema = customAuthSchema.extend({
  apiUrl: z
    .url()
    .describe("Alamat server Evolution API, mis. https://evolution.contoh.com"),
  apiKey: z
    .string()
    .trim()
    .min(1)
    .describe("API key Evolution API (header apikey)"),
  instanceName: z
    .string()
    .trim()
    .min(1)
    .describe("Nama instance WhatsApp di Evolution API"),
})
export type EvolutionWhatsappAuthValue = z.infer<
  typeof evolutionWhatsappAuthSchema
>

export type EvolutionWhatsappActions = {
  connect: (props: {
    apiUrl: string
    apiKey: string
    instanceName: string
  }) => Promise<{ instanceName: string; status: string }>
  registerWebhook: (props: {
    apiUrl: string
    apiKey: string
    instanceName: string
    webhookUrl: string
  }) => Promise<void>
}

// ─── Evolution API webhook payload (Baileys envelope) ──────────────────────
// Bentuk persis yang sudah diverifikasi & ditangani Bintang sekarang (lihat
// bintang-advertising-backend/api/views/whatsapp.py EvolutionWebhookView) --
// disalin apa adanya, BUKAN ditebak dari dokumentasi Evolution API.

export const evolutionMessageKeySchema = z.object({
  remoteJid: z.string().optional(),
  fromMe: z.boolean().optional(),
  id: z.string().optional(),
})
export type EvolutionMessageKey = z.infer<typeof evolutionMessageKeySchema>

export const evolutionMessageContentSchema = z.object({
  conversation: z.string().optional(),
  extendedTextMessage: z.object({ text: z.string().optional() }).optional(),
  imageMessage: z
    .object({
      caption: z.string().optional(),
      url: z.string().optional(),
      mimetype: z.string().optional(),
    })
    .optional(),
  videoMessage: z
    .object({
      caption: z.string().optional(),
      url: z.string().optional(),
      mimetype: z.string().optional(),
    })
    .optional(),
  documentMessage: z
    .object({
      caption: z.string().optional(),
      url: z.string().optional(),
      mimetype: z.string().optional(),
      fileName: z.string().optional(),
    })
    .optional(),
  audioMessage: z
    .object({ url: z.string().optional(), mimetype: z.string().optional() })
    .optional(),
  buttonsResponseMessage: z
    .object({ selectedButtonId: z.string().optional() })
    .optional(),
  templateButtonReplyMessage: z
    .object({ selectedId: z.string().optional() })
    .optional(),
})
export type EvolutionMessageContent = z.infer<
  typeof evolutionMessageContentSchema
>

export const evolutionWebhookDataSchema = z.object({
  key: evolutionMessageKeySchema.optional(),
  message: evolutionMessageContentSchema.optional(),
  pushName: z.string().optional(),
})
export type EvolutionWebhookData = z.infer<typeof evolutionWebhookDataSchema>

export const evolutionWebhookPayloadSchema = z.object({
  event: z.string().optional(),
  instance: z.string().optional(),
  data: evolutionWebhookDataSchema.optional(),
})
export type EvolutionWebhookPayload = z.infer<
  typeof evolutionWebhookPayloadSchema
>

// ─── Outgoing (send) request shapes ─────────────────────────────────────────

export type EvolutionSendTextRequest = {
  number: string
  text: string
  options?: { delay?: number; presence?: "composing" | "paused" }
}

export type EvolutionSendMediaRequest = {
  number: string
  mediatype: "image" | "video" | "document" | "audio"
  media: string
  caption?: string
  fileName?: string
}

export type EvolutionSendPresenceRequest = {
  number: string
  presence: "composing" | "paused" | "recording"
}

export type EvolutionSendResponse = {
  key?: { id?: string }
}

export type EvolutionInstanceConnectionState = {
  instance?: { state?: string }
}

export type EvolutionProfilePictureResponse = {
  profilePictureUrl?: string
}
