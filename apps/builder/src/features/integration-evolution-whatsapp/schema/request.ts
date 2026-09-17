import { z } from "zod"

export const connectEvolutionWhatsappRequest = z.object({
  name: z.string().trim().min(1).max(40),
  apiUrl: z.url(),
  apiKey: z.string().trim().min(1),
  instanceName: z.string().trim().min(1),
  workspaceId: z.string().nullish(),
})

export type ConnectEvolutionWhatsappRequest = z.infer<
  typeof connectEvolutionWhatsappRequest
>
