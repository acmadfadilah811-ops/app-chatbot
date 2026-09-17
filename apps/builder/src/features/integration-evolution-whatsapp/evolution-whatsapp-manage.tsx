"use client"

import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@chatbotx.io/ui/components/ui/table"
import { PlusCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { use } from "react"
import { AddChannelButton } from "@/features/inboxes/components/add-channel-button"
import { useChannelDuplicatedError } from "@/hooks/use-channel-duplicated-error"
import { EvolutionWhatsappConnect } from "./components/evolution-whatsapp-connect"
import { EvolutionWhatsappDisconnect } from "./components/evolution-whatsapp-disconnect"
import type { listIntegrationEvolutionWhatsapps } from "./queries"

type EvolutionWhatsappManageProps = {
  canCreate?: boolean
  workspaceId: string
  promises: Promise<
    [Awaited<ReturnType<typeof listIntegrationEvolutionWhatsapps>>]
  >
}

export function EvolutionWhatsappManage({
  canCreate = true,
  workspaceId,
  promises,
}: EvolutionWhatsappManageProps) {
  const [{ data: integrationEvolutionWhatsapps }] = use(promises)
  const t = useTranslations()

  useChannelDuplicatedError("evolutionWhatsapp")

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end gap-2">
        <AddChannelButton
          canCreate={canCreate}
          label={t("fields.evolutionWhatsapp.label")}
          render={
            <EvolutionWhatsappConnect workspaceId={workspaceId}>
              <Button size="sm" variant="secondary">
                <PlusCircleIcon className="h-4 w-4" />
                {t("actions.addFeature", {
                  feature: t("fields.evolutionWhatsapp.label"),
                })}
              </Button>
            </EvolutionWhatsappConnect>
          }
        />
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("fields.name.label")}</TableHead>
              <TableHead className="w-50" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {integrationEvolutionWhatsapps.map(
              (integrationEvolutionWhatsapp) => (
                <TableRow key={integrationEvolutionWhatsapp.id}>
                  <TableCell>{integrationEvolutionWhatsapp.name}</TableCell>
                  <TableCell className="flex w-50 justify-end gap-2">
                    <EvolutionWhatsappDisconnect
                      integrationEvolutionWhatsapp={
                        integrationEvolutionWhatsapp
                      }
                    />
                  </TableCell>
                </TableRow>
              ),
            )}
            {integrationEvolutionWhatsapps.length === 0 && (
              <TableRow>
                <TableCell colSpan={3}>No data</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
