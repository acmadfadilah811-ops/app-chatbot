import type { HandleRequestProps } from "@chatbotx.io/sdk"
import { EvolutionWhatsappWebhookException } from "../exception"
import type { EvolutionWhatsappConfig } from "../schema"
import { evolutionWebhookPayloadSchema } from "../schema"

// Evolution API sends MANY event types to the same webhook URL (connection
// updates, qr code refresh, etc.) -- only messages.upsert carries an actual
// inbound chat message. Payload shape (event/data.key/data.message/
// data.pushName) verified against Bintang's own production
// EvolutionWebhookView, not guessed from docs.
const MESSAGE_EVENT_NAMES = new Set([
  "messages.upsert",
  "MESSAGES_UPSERT",
  "message.upsert",
])

export const webhookHandler = async (
  props: HandleRequestProps<EvolutionWhatsappConfig>,
): Promise<string> => {
  const { req, config, queue } = props

  const body = await req.text()
  if (!body) {
    throw new EvolutionWhatsappWebhookException("Empty webhook payload")
  }

  const payload = evolutionWebhookPayloadSchema.parse(JSON.parse(body))

  if (!(payload.event && MESSAGE_EVENT_NAMES.has(payload.event))) {
    return "ok"
  }

  const data = payload.data
  if (!data?.key) {
    return "ok"
  }

  // Messages the connected number itself sent (fromMe) are ECHOES of an
  // outbound send (including replies Bintang staff type directly in
  // WhatsApp) -- not a customer message to react to.
  if (data.key.fromMe) {
    return "ok"
  }

  const remoteJid = data.key.remoteJid ?? ""
  // Group messages (`@g.us`) are intentionally skipped -- matches Bintang's
  // current bot (a personal order-taking assistant, not a group bot). Not
  // a technical limitation: enabling groups later is just deleting this
  // one check, contact/message mapping below already works off `remoteJid`
  // generically.
  if (!remoteJid || remoteJid.endsWith("@g.us")) {
    return "ok"
  }

  const integrationIdentifier = config.instanceName ?? payload.instance ?? ""

  await queue?.add("incomingMessage", {
    type: "incomingMessage",
    data: {
      integrationType: "evolutionWhatsapp",
      integrationIdentifier,
      payload,
    },
  })

  return "ok"
}
