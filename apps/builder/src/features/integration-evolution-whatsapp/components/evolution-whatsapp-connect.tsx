"use client"

import { InputField } from "@chatbotx.io/ui/components/form/input-field"
import { Button } from "@chatbotx.io/ui/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@chatbotx.io/ui/components/ui/dialog"
import { Form } from "@chatbotx.io/ui/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks"
import { Loader2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import type { ReactElement } from "react"
import { useState } from "react"
import { toast } from "sonner"
import { connectEvolutionWhatsappAction } from "../actions/connect.action"
import { connectEvolutionWhatsappRequest } from "../schema/request"

export function EvolutionWhatsappConnect({
  workspaceId,
  children,
  autoOpen = false,
}: {
  workspaceId?: string | null
  children?: ReactElement
  autoOpen?: boolean
}) {
  const t = useTranslations()
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen)

  const { form, handleSubmitWithAction } = useHookFormAction(
    connectEvolutionWhatsappAction,
    zodResolver(connectEvolutionWhatsappRequest),
    {
      actionProps: {
        onSuccess: () => {
          setOpen(false)
          if (workspaceId) {
            router.push(
              `/space/${workspaceId}/settings/channels/evolutionWhatsapp`,
            )
          } else {
            router.push("/")
          }
        },
        onError: ({ error }) => {
          if (error.serverError) {
            toast.error(error.serverError)
          }
        },
      },
      formProps: {
        mode: "onChange",
        defaultValues: {
          name: "",
          apiUrl: "",
          apiKey: "",
          instanceName: "",
          workspaceId,
        },
      },
    },
  )

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={children} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("actions.addFeature", {
              feature: t("fields.evolutionWhatsapp.label"),
            })}
          </DialogTitle>
          <DialogDescription>
            {t("fields.evolutionWhatsapp.connectDescription")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmitWithAction}
          >
            <InputField name="workspaceId" type="hidden" />
            <InputField
              label={t("fields.evolutionWhatsapp.name")}
              name="name"
              required
            />
            <InputField
              label={t("fields.evolutionWhatsapp.apiUrl")}
              name="apiUrl"
              placeholder="https://evolution.example.com"
              required
              type="url"
            />
            <InputField
              label={t("fields.evolutionWhatsapp.apiKey")}
              name="apiKey"
              required
              type="password"
            />
            <InputField
              label={t("fields.evolutionWhatsapp.instanceName")}
              name="instanceName"
              required
            />
            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="secondary">
                    {t("actions.cancel")}
                  </Button>
                }
              />
              <Button
                disabled={
                  !form.formState.isValid || form.formState.isSubmitting
                }
                type="submit"
              >
                {form.formState.isSubmitting && (
                  <Loader2Icon className="animate-spin" />
                )}
                {t("actions.connect")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
