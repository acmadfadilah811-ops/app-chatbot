import { evolutionWhatsappIntegrationService } from "@chatbotx.io/business"
import type { IntegrationEvolutionWhatsappModel } from "@chatbotx.io/database/types"

export const listIntegrationEvolutionWhatsapps = async ({
  where,
}: {
  where: Partial<Pick<IntegrationEvolutionWhatsappModel, "workspaceId">>
}): Promise<{ data: IntegrationEvolutionWhatsappModel[] }> => {
  const data = await evolutionWhatsappIntegrationService.listByWorkspace(where)

  return { data }
}
