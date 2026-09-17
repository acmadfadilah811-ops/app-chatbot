import {
  HandleRequestType,
  Integration,
  type IntegrationDefinition,
} from "@chatbotx.io/sdk"
import { connect, registerWebhook } from "./apis/evolution"
import { EvolutionWhatsappAPIException } from "./exception"
import { contactHandlers } from "./handlers/contact"
import { conversationHandlers } from "./handlers/conversation"
import { messageHandlers } from "./handlers/message"
import { webhookHandler } from "./handlers/webhook"
import type {
  EvolutionWhatsappActions,
  EvolutionWhatsappAuthValue,
  EvolutionWhatsappConfig,
} from "./schema"

const config: IntegrationDefinition<
  EvolutionWhatsappConfig,
  EvolutionWhatsappAuthValue,
  EvolutionWhatsappActions
> = {
  name: "evolutionWhatsapp",
  channels: {
    channel: {
      message: messageHandlers,
      conversation: conversationHandlers,
      contact: contactHandlers,
    },
  },
  actions: {
    connect: async ({ apiUrl, apiKey, instanceName }) =>
      await connect({ apiUrl, apiKey, instanceName }),
    registerWebhook: async ({ apiUrl, apiKey, instanceName, webhookUrl }) =>
      await registerWebhook({ apiUrl, apiKey, instanceName, webhookUrl }),
  },
  handleRequest: async (props) => {
    const segments = new URL(props.req.url).pathname.split("/")
    const action = segments.pop()

    switch (action) {
      case HandleRequestType.webhook:
        return await webhookHandler(props)
      default:
        throw new EvolutionWhatsappAPIException(
          `${props.req.method} ${props.req.url} is not implemented`,
        )
    }
  },
  // Evolution API instances are logged out from the Evolution admin side
  // (scan-QR-again / delete-instance), not from ChatbotX -- there is no
  // per-workspace "revoke" call to make here. Matches the disconnect
  // contract other self-hosted/no-OAuth channels (smtp, webchat) use:
  // a no-op that just lets ChatbotX stop calling this instance.
  disconnect: async (_auth: EvolutionWhatsappAuthValue): Promise<void> => {
    // Intentionally empty.
  },
}

export const integration = new Integration<
  IntegrationDefinition<
    EvolutionWhatsappConfig,
    EvolutionWhatsappAuthValue,
    EvolutionWhatsappActions
  >
>(config)
