import { type ConversationHandlers, SdkException } from "@chatbotx.io/sdk"
import { sendEvolutionPresence } from "../apis/evolution"
import type { EvolutionWhatsappAuthValue } from "../schema"

const sendTyping: ConversationHandlers<EvolutionWhatsappAuthValue>["sendTyping"] =
  async (props) => {
    const {
      ctx,
      data: { contact, typing },
    } = props

    const number = contact.sourceId
    if (!number) {
      throw new SdkException("Missing phone number in conversation")
    }

    await sendEvolutionPresence(ctx.auth, {
      number,
      presence: typing ? "composing" : "paused",
    })
  }

export const conversationHandlers: Partial<
  ConversationHandlers<EvolutionWhatsappAuthValue>
> = {
  sendTyping,
}
