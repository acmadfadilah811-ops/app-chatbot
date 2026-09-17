import { getIdFromParams } from "@chatbotx.io/utils"
import { notFound } from "next/navigation"
import { EvolutionWhatsappManage } from "@/features/integration-evolution-whatsapp/evolution-whatsapp-manage"
import { listIntegrationEvolutionWhatsapps } from "@/features/integration-evolution-whatsapp/queries"
import { requireVisibleChannel } from "@/lib/workspace/require-visible-channel"
import { resolveChannelCreatable } from "@/lib/workspace/resolve-channel-creatable"

export default async function SettingChannelEvolutionWhatsappPage(props: {
  params: Promise<{ workspaceId: string }>
}) {
  const workspaceId = getIdFromParams(await props.params, "workspaceId")
  if (!workspaceId) {
    return notFound()
  }

  await requireVisibleChannel(workspaceId, "evolutionWhatsapp")

  const promises = Promise.all([
    listIntegrationEvolutionWhatsapps({
      where: { workspaceId },
    }),
  ])
  const canCreate = await resolveChannelCreatable(
    workspaceId,
    "evolutionWhatsapp",
  )

  return (
    <EvolutionWhatsappManage
      canCreate={canCreate}
      promises={promises}
      workspaceId={workspaceId}
    />
  )
}
