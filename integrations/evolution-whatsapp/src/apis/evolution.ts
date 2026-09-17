import { rescue } from "../exception"
import { createEvolutionClient } from "../lib/http-client"
import type {
  EvolutionInstanceConnectionState,
  EvolutionProfilePictureResponse,
  EvolutionSendMediaRequest,
  EvolutionSendPresenceRequest,
  EvolutionSendResponse,
  EvolutionSendTextRequest,
  EvolutionWhatsappAuthValue,
} from "../schema"

/**
 * `/message/sendText/{instance}` body shape verified against Bintang's own
 * existing production client (whatsapp_client.py's send_text_message) --
 * NOT guessed from Evolution API docs alone.
 */
export const sendEvolutionText = (
  auth: EvolutionWhatsappAuthValue,
  payload: EvolutionSendTextRequest,
): Promise<string | undefined> =>
  rescue("sendText", async () => {
    const client = createEvolutionClient(auth.apiUrl, auth.apiKey)
    const response = await client.post<EvolutionSendResponse>(
      `message/sendText/${auth.instanceName}`,
      { json: payload },
    )
    return response.key?.id
  })

// Standard Evolution API v2 endpoint shape for outbound media -- not yet
// exercised by Bintang's existing bot (which is text-only for the AI
// conversation this integration serves), included for completeness since
// the flow builder's sendImage/sendFile steps expect it to exist.
export const sendEvolutionMedia = (
  auth: EvolutionWhatsappAuthValue,
  payload: EvolutionSendMediaRequest,
): Promise<string | undefined> =>
  rescue("sendMedia", async () => {
    const client = createEvolutionClient(auth.apiUrl, auth.apiKey)
    const response = await client.post<EvolutionSendResponse>(
      `message/sendMedia/${auth.instanceName}`,
      { json: payload },
    )
    return response.key?.id
  })

export const sendEvolutionPresence = (
  auth: EvolutionWhatsappAuthValue,
  payload: EvolutionSendPresenceRequest,
): Promise<void> =>
  rescue("sendPresence", async () => {
    const client = createEvolutionClient(auth.apiUrl, auth.apiKey)
    await client.post(`chat/sendPresence/${auth.instanceName}`, {
      json: payload,
    })
  })

export const getEvolutionProfilePictureUrl = async (
  auth: EvolutionWhatsappAuthValue,
  number: string,
): Promise<string | undefined> => {
  try {
    return await rescue("fetchProfilePictureUrl", async () => {
      const client = createEvolutionClient(auth.apiUrl, auth.apiKey)
      const response = await client.post<EvolutionProfilePictureResponse>(
        `chat/fetchProfilePictureUrl/${auth.instanceName}`,
        { json: { number } },
      )
      return response.profilePictureUrl
    })
  } catch {
    // No profile picture set, or the number isn't reachable -- not fatal,
    // the contact is still usable without an avatar.
    return
  }
}

/**
 * Verifies the credentials actually work AND the instance is really
 * connected to WhatsApp (not just that the API key is valid) -- used by
 * the connect action so a stale/logged-out instance surfaces as a clear
 * error immediately, instead of silently connecting a channel that will
 * fail on the first real message.
 */
export const connect = ({
  apiUrl,
  apiKey,
  instanceName,
}: {
  apiUrl: string
  apiKey: string
  instanceName: string
}): Promise<{ instanceName: string; status: string }> =>
  rescue("connectionState", async () => {
    const client = createEvolutionClient(apiUrl, apiKey)
    const response = await client.get<EvolutionInstanceConnectionState>(
      `instance/connectionState/${instanceName}`,
    )
    const state = response.instance?.state ?? "unknown"
    return { instanceName, status: state }
  })

/**
 * Evolution API's webhook config is per-instance, not per-message-type --
 * MESSAGES_UPSERT is the one event this integration's handler actually
 * parses (see handlers/webhook.ts); other event types Evolution sends are
 * simply ignored there, matching Bintang's existing EvolutionWebhookView.
 */
export const registerWebhook = ({
  apiUrl,
  apiKey,
  instanceName,
  webhookUrl,
}: {
  apiUrl: string
  apiKey: string
  instanceName: string
  webhookUrl: string
}): Promise<void> =>
  rescue("setWebhook", async () => {
    const client = createEvolutionClient(apiUrl, apiKey)
    await client.post(`webhook/set/${instanceName}`, {
      json: {
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          events: ["MESSAGES_UPSERT"],
        },
      },
    })
  })
