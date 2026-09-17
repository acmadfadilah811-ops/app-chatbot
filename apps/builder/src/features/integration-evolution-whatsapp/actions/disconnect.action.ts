"use server"

import {
  evolutionWhatsappIntegrationService,
  workspaceService,
} from "@chatbotx.io/business"
import { auditService } from "@chatbotx.io/business/audit"
import type { EvolutionWhatsappAuthValue } from "@chatbotx.io/integration-evolution-whatsapp"
import {
  type WorkspaceIdAndIdRequestParams,
  workspaceIdAndIdRequestParams,
} from "@/features/common/schema"
import { integrations } from "@/integration"
import { logger } from "@/lib/log"
import { workspaceActionClientAllowExpired } from "@/lib/safe-action"

export const disconnectEvolutionWhatsappAction =
  workspaceActionClientAllowExpired
    .bindArgsSchemas(workspaceIdAndIdRequestParams)
    .action(
      async ({
        bindArgsParsedInputs: [workspaceId, id],
      }: {
        bindArgsParsedInputs: WorkspaceIdAndIdRequestParams
      }) => {
        const [integrationEvolutionWhatsapp, workspace] = await Promise.all([
          evolutionWhatsappIntegrationService.findByIdForWorkspace({
            id,
            workspaceId,
          }),
          workspaceService.findById({ id: workspaceId }),
        ])

        try {
          await integrations.evolutionWhatsapp.disconnect(
            integrationEvolutionWhatsapp.auth as EvolutionWhatsappAuthValue,
          )
        } catch (error) {
          logger.warn(
            error,
            "Evolution WhatsApp disconnect API call failed — proceeding with local cleanup",
          )
        }

        await evolutionWhatsappIntegrationService.disconnect({
          workspaceId,
          id: integrationEvolutionWhatsapp.id,
          inboxId: integrationEvolutionWhatsapp.inboxId,
          ownerId: workspace.ownerId,
        })

        await auditService.record({
          action: "disconnect",
          detail: `disconnected the Evolution WhatsApp channel (#${integrationEvolutionWhatsapp.id})`,
        })
      },
    )
