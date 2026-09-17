"use server"

import {
  evolutionWhatsappIntegrationService,
  hasWorkspaceAccess,
  userQuotaService,
  workspaceService,
} from "@chatbotx.io/business"
import { auditService } from "@chatbotx.io/business/audit"
import { ChatbotXException } from "@chatbotx.io/business/errors"
import type { UserModel } from "@chatbotx.io/database/types"
import { redirect } from "next/navigation"
import { isCloud } from "@/env"
import { integrations } from "@/integration"
import { logger } from "@/lib/log"
import { buildBrokerCallbackUrl } from "@/lib/oauth-broker"
import { authActionClient } from "@/lib/safe-action"
import {
  type ConnectEvolutionWhatsappRequest,
  connectEvolutionWhatsappRequest,
} from "../schema/request"

export const connectEvolutionWhatsappAction = authActionClient
  .inputSchema(connectEvolutionWhatsappRequest)
  .action(
    async ({
      parsedInput,
      ctx,
    }: {
      parsedInput: ConnectEvolutionWhatsappRequest
      ctx: { user: UserModel }
    }) => {
      try {
        const workspaceId = parsedInput.workspaceId ?? undefined

        // Validate the server/instance is reachable before persisting anything
        await integrations.evolutionWhatsapp.runAction("connect", {
          apiUrl: parsedInput.apiUrl,
          apiKey: parsedInput.apiKey,
          instanceName: parsedInput.instanceName,
        })

        let ownerId = ctx.user.id
        if (workspaceId) {
          if (!(await hasWorkspaceAccess({ workspaceId, user: ctx.user }))) {
            throw new ChatbotXException("Workspace not found", "notFound", 404)
          }
          const workspace = await workspaceService.findOrFail({
            where: { id: workspaceId },
          })
          ownerId = workspace.ownerId
        }

        if (!workspaceId && isCloud()) {
          const { blocked, reason } = await userQuotaService.getAccessState(
            ctx.user.id,
          )
          if (blocked) {
            throw reason === "mac"
              ? new ChatbotXException(
                  "Monthly active contact limit reached",
                  "macLimitReached",
                  403,
                )
              : new ChatbotXException("Trial expired", "trialExpired", 403)
          }
        }

        const result = await evolutionWhatsappIntegrationService.connect({
          workspaceId,
          ownerId,
          createdBy: ctx.user.id,
          name: parsedInput.name,
          apiUrl: parsedInput.apiUrl,
          apiKey: parsedInput.apiKey,
          instanceName: parsedInput.instanceName,
          onConnected: async () => {
            const webhookUrl = buildBrokerCallbackUrl(
              "/integrations/evolutionWhatsapp/webhook",
            )
            await integrations.evolutionWhatsapp.runAction("registerWebhook", {
              apiUrl: parsedInput.apiUrl,
              apiKey: parsedInput.apiKey,
              instanceName: parsedInput.instanceName,
              webhookUrl,
            })
          },
        })

        if (result.createdWorkspace) {
          await auditService.record({
            userId: ctx.user.id,
            workspaceId: result.workspaceId,
            action: "create",
            detail: `created the workspace (#${result.workspaceId})`,
          })
        }

        if (result.wasCreated) {
          await auditService.record({
            workspaceId: result.workspaceId,
            action: "connect",
            detail: `connected a new Evolution WhatsApp channel (#${result.integrationId})`,
          })
        }

        return { workspaceId: result.workspaceId }
      } catch (error) {
        if (error instanceof ChatbotXException) {
          if (error.code === "channelDuplicated" && parsedInput.workspaceId) {
            redirect(
              `/space/${parsedInput.workspaceId}/settings/channels?channel=evolutionWhatsapp&error=duplicated`,
            )
          }
          throw error
        }

        logger.error(error, "Failed to connect Evolution WhatsApp instance")
        throw new ChatbotXException(
          "Failed to connect. Please check the server URL, API key, and instance name and try again.",
        )
      }
    },
  )
