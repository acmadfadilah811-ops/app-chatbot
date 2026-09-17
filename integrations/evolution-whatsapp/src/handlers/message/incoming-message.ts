import {
  type Context,
  contentTypes,
  type IncomingAttachment,
  type IncomingContact,
  type IncomingMessage,
  messageTypes,
  type ReceivedMessageResult,
} from "@chatbotx.io/sdk"
import { EvolutionWhatsappException } from "../../exception"
import type {
  EvolutionMessageContent,
  EvolutionWebhookPayload,
  EvolutionWhatsappAuthValue,
} from "../../schema"
import { evolutionWebhookPayloadSchema } from "../../schema"

export const receiveMessage = ({
  data,
}: {
  ctx: Context<EvolutionWhatsappAuthValue>
  data: {
    integrationType: string
    integrationIdentifier: string
    payload: unknown
  }
}): Promise<ReceivedMessageResult> => {
  const payload = evolutionWebhookPayloadSchema.parse(data.payload)

  if (!payload.data?.key?.remoteJid) {
    throw new EvolutionWhatsappException(
      "Missing key.remoteJid in Evolution webhook payload",
    )
  }

  return Promise.resolve(getMessageResult(payload))
}

const getMessageResult = (
  payload: EvolutionWebhookPayload,
): ReceivedMessageResult => {
  const remoteJid = payload.data?.key?.remoteJid as string
  // WhatsApp jid is "<number>@s.whatsapp.net" -- the number itself is the
  // stable per-contact identity, same as Bintang's existing
  // `sender.split('@')[0]` extraction.
  const phoneNumber = remoteJid.split("@")[0]

  const messageContent = payload.data?.message
  const { text, attachments } = extractTextAndAttachments(messageContent)

  const incomingMessage: IncomingMessage = {
    sourceId: payload.data?.key?.id ?? phoneNumber,
    messageType: messageTypes.enum.incoming,
    text,
    contentType: contentTypes.enum.text,
    attachments,
  }

  const contact: IncomingContact = {
    sourceId: phoneNumber,
    phoneNumber,
    firstName: payload.data?.pushName || phoneNumber,
  }

  return {
    message: incomingMessage,
    contact,
    postbackAction: null,
    quickReplyAction: null,
    ref: null,
  }
}

/**
 * Text extraction priority mirrors Bintang's existing production webhook
 * handler exactly (api/views/whatsapp.py EvolutionWebhookView) --
 * conversation -> extendedTextMessage -> image/video/document message
 * caption.
 *
 * Attachments: Evolution/Baileys media URLs are normally end-to-end
 * encrypted (mediaKey + fileEncSha256), not directly downloadable without
 * Baileys-side decryption -- Bintang's own current client does not decrypt
 * them either (it only ever read the raw `.url` field). Passing the raw
 * URL through here preserves that SAME behavior/limitation rather than
 * silently pretending attachment download works; revisit if/when Evolution
 * API is configured to resolve pre-decrypted base64 media in the webhook.
 */
function extractTextAndAttachments(
  messageContent: EvolutionMessageContent | undefined,
): { text: string | undefined; attachments: IncomingAttachment[] } {
  if (!messageContent) {
    return { text: undefined, attachments: [] }
  }

  const text =
    messageContent.conversation ||
    messageContent.extendedTextMessage?.text ||
    messageContent.imageMessage?.caption ||
    messageContent.videoMessage?.caption ||
    messageContent.documentMessage?.caption ||
    undefined

  const attachments: IncomingAttachment[] = []
  if (messageContent.imageMessage?.url) {
    attachments.push({
      sourceId: messageContent.imageMessage.url,
      fileType: "image",
      mimeType: messageContent.imageMessage.mimetype ?? "image/jpeg",
      originPath: messageContent.imageMessage.url,
      size: 0,
      url: messageContent.imageMessage.url,
    })
  } else if (messageContent.videoMessage?.url) {
    attachments.push({
      sourceId: messageContent.videoMessage.url,
      fileType: "video",
      mimeType: messageContent.videoMessage.mimetype ?? "video/mp4",
      originPath: messageContent.videoMessage.url,
      size: 0,
      url: messageContent.videoMessage.url,
    })
  } else if (messageContent.documentMessage?.url) {
    attachments.push({
      sourceId: messageContent.documentMessage.url,
      fileType: "file",
      mimeType:
        messageContent.documentMessage.mimetype ?? "application/octet-stream",
      originPath: messageContent.documentMessage.url,
      size: 0,
      url: messageContent.documentMessage.url,
      name: messageContent.documentMessage.fileName,
    })
  }

  return { text, attachments }
}
