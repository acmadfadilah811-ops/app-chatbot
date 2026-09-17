import type { ContactHandlers } from "@chatbotx.io/sdk"
import { getEvolutionProfilePictureUrl } from "../apis/evolution"
import type { EvolutionWhatsappAuthValue } from "../schema"

const getProfile: ContactHandlers<EvolutionWhatsappAuthValue>["getProfile"] =
  async ({ ctx, data: { sourceId } }) => {
    const avatar = await getEvolutionProfilePictureUrl(ctx.auth, sourceId)
    return {
      sourceId,
      phoneNumber: sourceId,
      avatar,
    }
  }

export const contactHandlers: Partial<
  ContactHandlers<EvolutionWhatsappAuthValue>
> = {
  getProfile,
}
