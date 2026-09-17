import { index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core"
import { bigintAsString, sharedColumns } from "../partials/shared"
import { inboxModel } from "./inbox"
import { workspaceModel } from "./workspace"

export const integrationEvolutionWhatsappModel = pgTable(
  "IntegrationEvolutionWhatsapp",
  {
    ...sharedColumns,
    // Full custom auth (apiUrl, apiKey, instanceName) -- see
    // integrations/evolution-whatsapp/src/schema.ts
    // evolutionWhatsappAuthSchema.
    auth: jsonb().$type<{ [x: string]: unknown }>().notNull(),
    // Denormalized copy of auth.instanceName, set once at connect time --
    // this is the ONLY column apps/worker/src/services/integrations.ts's
    // identifyInboxAndIntegrationAuthFromIdentifier() queries to route an
    // inbound webhook to this row (Evolution API's webhook payload carries
    // the instance name at its top level). Mirrors
    // IntegrationTelegram.botId's exact role.
    instanceName: text().notNull(),
    name: text().notNull(),
    workspaceId: bigintAsString()
      .notNull()
      .references(() => workspaceModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    inboxId: bigintAsString()
      .notNull()
      .references(() => inboxModel.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
  },
  (table) => [
    index("IntegrationEvolutionWhatsapp_workspaceId_idx").using(
      "btree",
      table.workspaceId.asc().nullsLast(),
    ),
    uniqueIndex("IntegrationEvolutionWhatsapp_inboxId_key").using(
      "btree",
      table.inboxId.asc().nullsLast(),
    ),
    uniqueIndex("IntegrationEvolutionWhatsapp_instanceName_key").using(
      "btree",
      table.instanceName.asc().nullsLast(),
    ),
  ],
)
