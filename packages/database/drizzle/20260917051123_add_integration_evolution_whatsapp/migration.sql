CREATE TABLE "IntegrationEvolutionWhatsapp" (
	"id" bigint PRIMARY KEY,
	"createdAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp(6) with time zone DEFAULT now() NOT NULL,
	"auth" jsonb NOT NULL,
	"instanceName" text NOT NULL,
	"name" text NOT NULL,
	"workspaceId" bigint NOT NULL,
	"inboxId" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "IntegrationEvolutionWhatsapp_workspaceId_idx" ON "IntegrationEvolutionWhatsapp" ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationEvolutionWhatsapp_inboxId_key" ON "IntegrationEvolutionWhatsapp" ("inboxId");--> statement-breakpoint
CREATE UNIQUE INDEX "IntegrationEvolutionWhatsapp_instanceName_key" ON "IntegrationEvolutionWhatsapp" ("instanceName");--> statement-breakpoint
ALTER TABLE "IntegrationEvolutionWhatsapp" ADD CONSTRAINT "IntegrationEvolutionWhatsapp_workspaceId_Workspace_id_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "IntegrationEvolutionWhatsapp" ADD CONSTRAINT "IntegrationEvolutionWhatsapp_inboxId_Inbox_id_fkey" FOREIGN KEY ("inboxId") REFERENCES "Inbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;