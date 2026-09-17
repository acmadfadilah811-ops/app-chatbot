import { SdkException } from "@chatbotx.io/sdk"
import { isHTTPError } from "ky"
import { logger } from "./lib/logger"

function asObject<T>(value: unknown): T | undefined {
  return typeof value === "object" && value !== null ? (value as T) : undefined
}

const FALLBACK_HTTP_STATUS = 400

type ErrorBody = {
  message?: string | string[]
  error?: string
}
type OriginShape = { httpStatus?: number; errorBody?: ErrorBody }

export type ChannelErrorSource = {
  httpStatusCode: number
  code?: number | string
  subCode?: number | string | null
  type?: string
  message?: string
}

export function parseOriginError(originError: unknown): ChannelErrorSource {
  if (isHTTPError(originError)) {
    const body = asObject<ErrorBody>(originError.data)
    const message = Array.isArray(body?.message)
      ? body?.message.join("; ")
      : body?.message
    return {
      httpStatusCode: originError.response.status,
      code: body?.error,
      message,
    }
  }

  const shaped = asObject<OriginShape>(originError)
  if (shaped?.httpStatus !== undefined) {
    const body = shaped.errorBody
    const message = Array.isArray(body?.message)
      ? body?.message.join("; ")
      : body?.message
    return {
      httpStatusCode: shaped.httpStatus,
      code: body?.error,
      message,
    }
  }

  return {
    httpStatusCode: FALLBACK_HTTP_STATUS,
    message: originError instanceof Error ? originError.message : undefined,
  }
}

export class EvolutionWhatsappException extends SdkException {
  constructor(
    message: string,
    httpStatusCode: number = FALLBACK_HTTP_STATUS,
    code: string | number = "evolutionWhatsappError",
    subCode?: string | number | null,
    type?: string,
    originError?: unknown,
  ) {
    super(message, code, httpStatusCode, subCode, type)
    if (originError !== undefined) {
      this.setOriginError(originError)
    }
  }
}

export class EvolutionWhatsappWebhookException extends EvolutionWhatsappException {
  readonly webhookData?: unknown

  constructor(message: string, webhookData?: unknown) {
    super(`Webhook error: ${message}`)
    this.webhookData = webhookData
  }
}

export class EvolutionWhatsappAPIException extends EvolutionWhatsappException {}

/**
 * Wraps an async Evolution API call with standardized error handling --
 * same shape as every other integration's `rescue` (telegram, smtp, ...),
 * see error-mapper.ts's mapToChannelError() for the next step.
 */
export const rescue = async <T>(
  endpoint: string,
  fn: () => Promise<T>,
): Promise<T> => {
  try {
    return await fn()
  } catch (error) {
    logger.error(error, `Evolution API call failed: ${endpoint}`)

    let originError: unknown = error
    if (error instanceof EvolutionWhatsappException) {
      originError = error.getOriginError() ?? error
    }

    const sdkException = parseOriginError(originError)

    throw new EvolutionWhatsappAPIException(
      sdkException.message ?? endpoint,
      sdkException.httpStatusCode,
      sdkException.code,
      sdkException.subCode,
      sdkException.type,
      originError,
    )
  }
}
