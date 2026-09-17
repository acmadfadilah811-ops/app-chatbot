import { stepTypes } from "@chatbotx.io/flow-config"
import { contentTypes, type MessageHandlers } from "@chatbotx.io/sdk"
import { sendEvolutionMedia, sendEvolutionText } from "../../../apis/evolution"
import { DEFAULT_SEND_DELAY_MS } from "../../../constants"
import { mapToChannelError } from "../../../lib/error-mapper"
import { logger } from "../../../lib/logger"
import type { EvolutionWhatsappAuthValue } from "../../../schema"
import { convertFlowStepText } from "./send-text"

// Generic outbound send used for the AI agent's own conversational replies
// and any flow "Send Message" node -- covers text + a single attachment.
// No carousel/multi-image-group/quick-reply support: not something the 9
// Bintang tool flows or the AI agent's plain-text replies ever produce.
export const sendMessage: MessageHandlers<EvolutionWhatsappAuthValue>["sendMessage"] =
  async (props) => {
    const {
      ctx,
      data: { contact, message },
    } = props

    const messageIds: string[] = []

    try {
      if (message.contentType === contentTypes.enum.text && message.text) {
        const messageId = await sendEvolutionText(ctx.auth, {
          number: contact.sourceId,
          text: message.text,
          options: { delay: DEFAULT_SEND_DELAY_MS, presence: "composing" },
        })
        if (messageId) {
          messageIds.push(messageId)
        }
      }

      const attachments = message.attachments ?? []
      for (const attachment of attachments) {
        const mediatype =
          attachment.fileType === "image" ||
          attachment.fileType === "video" ||
          attachment.fileType === "audio"
            ? attachment.fileType
            : "document"
        const messageId = await sendEvolutionMedia(ctx.auth, {
          number: contact.sourceId,
          mediatype,
          media: attachment.url,
          fileName: attachment.name ?? undefined,
        })
        if (messageId) {
          messageIds.push(messageId)
        }
      }
    } catch (error) {
      logger.error(error, "An error occurred while sending the message")
      throw mapToChannelError(error)
    }

    return { messageIds }
  }

export const sendFlowStep: MessageHandlers<EvolutionWhatsappAuthValue>["sendFlowStep"] =
  async (props) => {
    const {
      ctx,
      data: { step },
    } = props

    const messageIds: string[] = []

    try {
      switch (step.stepType) {
        case stepTypes.enum.sendText: {
          for (const payload of convertFlowStepText(
            props as Parameters<
              MessageHandlers<
                EvolutionWhatsappAuthValue,
                typeof step
              >["sendFlowStep"]
            >[0],
          )) {
            const messageId = await sendEvolutionText(ctx.auth, payload)
            if (messageId) {
              messageIds.push(messageId)
            }
          }
          break
        }
        default:
          // Every other step type (sendImage, sendCarousel, sendQuickReply,
          // ...) is intentionally unimplemented -- the 9 Bintang tool
          // flows and the AI agent only ever use sendText (see
          // bintang-advertising-backend chatbotx_bridge.py's `ringkasan`
          // design). Silently no-op rather than throw: a flow author who
          // adds one of these steps to an evolutionWhatsapp-targeted flow
          // by mistake should see "nothing sent" during testing, not a
          // hard worker crash.
          logger.warn(
            { stepType: step.stepType },
            "evolutionWhatsapp: unimplemented flow step type, skipped",
          )
          break
      }
    } catch (error) {
      logger.error(error, "An error occurred while sending flow step")
      throw mapToChannelError(error)
    }

    return { messageIds }
  }
