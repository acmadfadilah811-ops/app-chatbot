import {
  ChannelError,
  ChannelErrorCategory,
  UNKNOWN_ERROR,
} from "@chatbotx.io/sdk"
import {
  type ChannelErrorSource,
  EvolutionWhatsappAPIException,
  parseOriginError,
} from "../exception"

function extractApiFields(
  exc: EvolutionWhatsappAPIException,
): ChannelErrorSource {
  return {
    message: exc.message,
    code: exc.code,
    subCode: exc.subCode ?? null,
    type: exc.type,
    httpStatusCode: exc.httpStatusCode,
  }
}

// Evolution API (Baileys-backed, unofficial WhatsApp Web bridge) doesn't
// document a stable error-code catalogue the way Telegram's Bot API does --
// most of what's below is HTTP-status-driven; description patterns cover
// the handful of messages actually observed via Bintang's existing
// whatsapp_client.py in production.
const NUMBER_NOT_ON_WHATSAPP_PATTERNS = [
  "number is not on whatsapp",
  "not a valid whatsapp number",
  "invalid number",
]

const INSTANCE_OFFLINE_PATTERNS = [
  "instance not found",
  "instance not connected",
  "connection closed",
  "not connected to whatsapp",
]

const RATE_LIMITED_PATTERNS = ["rate limit", "too many requests"]

function matchesAny(description: string, patterns: string[]): boolean {
  return patterns.some((p) => description.includes(p))
}

function categorize(
  httpStatus: number,
  description: string,
): ChannelErrorCategory {
  if (matchesAny(description, RATE_LIMITED_PATTERNS)) {
    return ChannelErrorCategory.RATE_LIMITED
  }
  if (matchesAny(description, NUMBER_NOT_ON_WHATSAPP_PATTERNS)) {
    return ChannelErrorCategory.INVALID_RECIPIENT
  }
  if (matchesAny(description, INSTANCE_OFFLINE_PATTERNS)) {
    return ChannelErrorCategory.AUTH_FAILED
  }

  if (httpStatus === 401 || httpStatus === 403) {
    return ChannelErrorCategory.AUTH_FAILED
  }
  if (httpStatus === 404) {
    return ChannelErrorCategory.INVALID_RECIPIENT
  }
  if (httpStatus === 429) {
    return ChannelErrorCategory.RATE_LIMITED
  }
  if (
    httpStatus === 400 ||
    httpStatus === 405 ||
    httpStatus === 406 ||
    httpStatus === 409
  ) {
    return ChannelErrorCategory.PAYLOAD_INVALID
  }
  if (httpStatus >= 500) {
    return ChannelErrorCategory.NETWORK_ERROR
  }

  return ChannelErrorCategory.UNKNOWN
}

function mapEvolutionStatus(fields: ChannelErrorSource): ChannelError {
  const description = (fields.message ?? "").toLowerCase()
  const category = categorize(fields.httpStatusCode, description)
  return new ChannelError(fields.message ?? UNKNOWN_ERROR.message, category, {
    code: fields.code ?? UNKNOWN_ERROR.code,
    httpStatusCode: fields.httpStatusCode,
  })
}

// Evolution API instances don't expire/rotate a token the way OAuth
// integrations do -- an apiKey is either right or it isn't. Always false,
// mirrors telegram's own reasoning (bot tokens aren't "revoked" either).
export function isRevokedTokenError(_error: unknown): boolean {
  return false
}

export function mapToChannelError(rawError: unknown): ChannelError {
  if (rawError instanceof ChannelError) {
    return rawError
  }

  if (rawError instanceof EvolutionWhatsappAPIException) {
    return mapEvolutionStatus(extractApiFields(rawError))
  }

  return mapEvolutionStatus(parseOriginError(rawError))
}
