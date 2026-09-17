import type { DatabaseClient } from "@chatbotx.io/database/client"
import {
  and,
  db,
  eq,
  findOrFail,
  isDatabaseError,
} from "@chatbotx.io/database/client"
import { integrationTypes } from "@chatbotx.io/database/partials"
import { integrationEvolutionWhatsappModel } from "@chatbotx.io/database/schema"
import type { IntegrationEvolutionWhatsappModel } from "@chatbotx.io/database/types"
import { createId } from "@chatbotx.io/utils"
import { BaseService } from "../base.service"
import { ChatbotXException } from "../errors"
import { connectChannelIntegration } from "../inbox/connect-channel"
import { inboxService } from "../inbox/service"
import { workspaceService } from "../workspace"

const UNIQUE_VIOLATION_CODE = "23505"

class EvolutionWhatsappIntegrationService extends BaseService {
  findByInboxIdForWorkspace(props: { inboxId: string; workspaceId: string }) {
    return findOrFail({
      table: integrationEvolutionWhatsappModel,
      where: { inboxId: props.inboxId, workspaceId: props.workspaceId },
    })
  }

  findByIdForWorkspace(props: { id: string; workspaceId: string }) {
    return findOrFail({
      table: integrationEvolutionWhatsappModel,
      where: { id: props.id, workspaceId: props.workspaceId },
      message: "Integration Evolution WhatsApp not found",
    })
  }

  async listByWorkspace(
    where: Partial<Pick<IntegrationEvolutionWhatsappModel, "workspaceId">>,
  ): Promise<IntegrationEvolutionWhatsappModel[]> {
    return await db.query.integrationEvolutionWhatsappModel.findMany({
      where,
      orderBy: {
        createdAt: "asc",
      },
    })
  }

  async findByInstanceName(
    instanceName: string,
  ): Promise<IntegrationEvolutionWhatsappModel | null> {
    return (
      (await db.query.integrationEvolutionWhatsappModel.findFirst({
        where: { instanceName },
      })) ?? null
    )
  }

  async connect(input: {
    workspaceId?: string
    ownerId: string
    createdBy: string
    name: string
    apiUrl: string
    apiKey: string
    instanceName: string
    onConnected: (ctx: { integrationId: string }) => Promise<void>
  }): Promise<{
    workspaceId: string
    createdWorkspace: boolean
    wasCreated: boolean
    integrationId: string
  }> {
    const {
      ownerId,
      createdBy,
      name,
      apiUrl,
      apiKey,
      instanceName,
      onConnected,
    } = input
    let { workspaceId } = input

    try {
      return await db.transaction(async (tx) => {
        const auth = {
          authType: "custom" as const,
          apiUrl,
          apiKey,
          instanceName,
        }
        let createdWorkspace = false
        let effectiveOwnerId = ownerId

        if (!workspaceId) {
          const workspace = await workspaceService.create({
            tx,
            createdBy,
            data: {
              name,
              timezone: "UTC",
              ownerId: createdBy,
            },
          })
          workspaceId = workspace.id
          effectiveOwnerId = createdBy
          createdWorkspace = true
        }

        const integrationId = createId()
        const { wasCreated } = await connectChannelIntegration({
          tx,
          ownerId: effectiveOwnerId,
          inboxData: {
            id: createId(),
            workspaceId,
            name,
            channel: integrationTypes.enum.evolutionWhatsapp,
            sourceId: instanceName,
          },
          insertIntegration: async (inboxId) => {
            await tx.insert(integrationEvolutionWhatsappModel).values({
              id: integrationId,
              inboxId,
              workspaceId: workspaceId as string,
              instanceName,
              name,
              auth,
            })
          },
        })

        await onConnected({ integrationId })

        return {
          workspaceId,
          createdWorkspace,
          wasCreated,
          integrationId,
        }
      })
    } catch (error) {
      if (
        isDatabaseError(error) &&
        error.cause.code === UNIQUE_VIOLATION_CODE
      ) {
        throw new ChatbotXException("Instance already connected")
      }
      throw error
    }
  }

  async disconnect(input: {
    workspaceId: string
    id: string
    inboxId: string
    ownerId: string
    tx?: DatabaseClient
  }): Promise<void> {
    const { workspaceId, id, inboxId, ownerId, tx } = input

    const run = async (client: DatabaseClient) => {
      await client
        .delete(integrationEvolutionWhatsappModel)
        .where(
          and(
            eq(integrationEvolutionWhatsappModel.id, id),
            eq(integrationEvolutionWhatsappModel.workspaceId, workspaceId),
          ),
        )
      await inboxService.disconnect({
        inboxId,
        ownerId,
        workspaceId,
        reason: "manual",
        tx: client,
      })
    }

    if (tx) {
      await run(tx)
      return
    }
    await db.transaction(run)
  }
}

export const evolutionWhatsappIntegrationService =
  new EvolutionWhatsappIntegrationService()
