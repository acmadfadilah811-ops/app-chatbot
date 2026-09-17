import { defineRelationsPart } from "drizzle-orm"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema
import * as schema from "../schema"

export const integrationEvolutionWhatsappRelations = defineRelationsPart(
  schema,
  (r) => ({
    integrationEvolutionWhatsappModel: {
      workspace: r.one.workspaceModel({
        from: r.integrationEvolutionWhatsappModel.workspaceId,
        to: r.workspaceModel.id,
        optional: false,
      }),
      inbox: r.one.inboxModel({
        from: r.integrationEvolutionWhatsappModel.inboxId,
        to: r.inboxModel.id,
        optional: false,
      }),
    },
  }),
)
