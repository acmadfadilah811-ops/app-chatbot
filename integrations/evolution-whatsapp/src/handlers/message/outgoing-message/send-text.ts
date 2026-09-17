import type { SendTextStepSchema } from "@chatbotx.io/flow-config"
import type { MessageHandlers } from "@chatbotx.io/sdk"
import { DEFAULT_SEND_DELAY_MS } from "../../../constants"
import type {
  EvolutionSendTextRequest,
  EvolutionWhatsappAuthValue,
} from "../../../schema"

// No buttons/quick-replies here on purpose: WhatsApp's own AI bot
// (services/wa_ai_tools.py, Bintang) deliberately stopped sending buttons
// entirely ("Bot tidak lagi PERNAH mengirim tombol") -- Evolution/Baileys'
// interactive-button support is unreliable across WhatsApp client
// versions, and the 9 tools this integration serves (see
// bintang-advertising-backend chatbotx_bridge.py) only ever reply with
// plain text ({{ringkasan}}).
export function* convertFlowStepText(
  props: Parameters<
    MessageHandlers<
      EvolutionWhatsappAuthValue,
      SendTextStepSchema
    >["sendFlowStep"]
  >[0],
): Generator<EvolutionSendTextRequest> {
  const {
    data: { step, contact },
  } = props

  yield {
    number: contact.sourceId,
    text: step.text,
    options: { delay: DEFAULT_SEND_DELAY_MS, presence: "composing" },
  }
}
