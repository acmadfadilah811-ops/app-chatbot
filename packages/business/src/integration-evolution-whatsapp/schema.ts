import {
  createSelectSchema,
  integrationEvolutionWhatsappModel,
} from "@chatbotx.io/database/schema"
import { zodBigintAsString } from "@chatbotx.io/utils"
import type { z } from "zod"

export const integrationEvolutionWhatsappResource = createSelectSchema(
  integrationEvolutionWhatsappModel,
  {
    id: zodBigintAsString(),
    inboxId: zodBigintAsString(),
    workspaceId: zodBigintAsString(),
  },
)

export type IntegrationEvolutionWhatsappResource = z.infer<
  typeof integrationEvolutionWhatsappResource
>
