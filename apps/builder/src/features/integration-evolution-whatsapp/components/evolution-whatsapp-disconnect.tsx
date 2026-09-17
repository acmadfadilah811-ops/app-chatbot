"use client"

import type { IntegrationEvolutionWhatsappResource } from "@chatbotx.io/business"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useAction } from "next-safe-action/hooks"
import { useState } from "react"
import { toast } from "sonner"
import { DisconnectIntegrationDialog } from "@/features/common/components/disconnect-integration-dialog"
import { disconnectEvolutionWhatsappAction } from "../actions/disconnect.action"

export function EvolutionWhatsappDisconnect({
  integrationEvolutionWhatsapp,
}: {
  integrationEvolutionWhatsapp: IntegrationEvolutionWhatsappResource
}) {
  const t = useTranslations()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { workspaceId } = useParams<{ workspaceId: string }>()

  const { executeAsync: onDisconnect, isPending: isPendingDisconnect } =
    useAction(
      disconnectEvolutionWhatsappAction.bind(
        null,
        workspaceId,
        integrationEvolutionWhatsapp.id,
      ),
      {
        onSuccess: () => {
          router.refresh()
        },
        onError: ({ error }) => {
          if (error.serverError) {
            toast.error(error.serverError)
          }
        },
      },
    )

  return (
    <DisconnectIntegrationDialog
      featureLabel={t("fields.evolutionWhatsapp.label")}
      isPending={isPendingDisconnect}
      onConfirm={onDisconnect}
      onOpenChange={setOpen}
      open={open}
    />
  )
}
