import ky, { isHTTPError, type KyInstance } from "ky"
import { EvolutionWhatsappAPIException, parseOriginError } from "../exception"
import { logger } from "./logger"

const TRAILING_SLASHES = /\/+$/

type GetOptions = {
  searchParams?: Record<string, string>
}

type PostOptions = {
  json?: unknown
}

class EvolutionHttpClient {
  private readonly client: KyInstance

  // apiUrl is per-workspace (self-hosted server), not a fixed constant
  // like Telegram's api.telegram.org -- every caller supplies it from the
  // connected auth. Endpoint paths passed to get()/post() already include
  // the trailing `/{instanceName}` segment Evolution API expects; kept
  // explicit at each call site rather than baked into the client so a
  // caller can never silently target the wrong instance.
  constructor(apiUrl: string, apiKey: string) {
    this.client = ky.create({
      prefix: apiUrl.replace(TRAILING_SLASHES, ""),
      timeout: 30_000,
      headers: { apikey: apiKey },
      retry: {
        limit: 3,
        methods: ["get", "post"],
        statusCodes: [408, 413, 429, 500, 502, 503, 504],
        backoffLimit: 1000,
      },
      hooks: {
        beforeError: [
          ({ error, request }) => {
            if (isHTTPError(error)) {
              logger.error(
                { url: request.url, method: request.method },
                `HTTP ${error.response.status}: ${error.response.statusText}`,
              )
            }
            return error
          },
        ],
      },
    })
  }

  private toException(error: unknown): EvolutionWhatsappAPIException {
    const sdkException = parseOriginError(error)

    return new EvolutionWhatsappAPIException(
      sdkException.message ?? "Evolution API call failed",
      sdkException.httpStatusCode,
      sdkException.code,
      sdkException.subCode,
      sdkException.type,
      error,
    )
  }

  private async request<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call()
    } catch (error) {
      throw this.toException(error)
    }
  }

  get<T>(endpoint: string, options?: GetOptions): Promise<T> {
    return this.request(() => this.client.get(endpoint, options).json<T>())
  }

  post<T>(endpoint: string, options?: PostOptions): Promise<T> {
    return this.request(() => this.client.post(endpoint, options).json<T>())
  }
}

export const createEvolutionClient = (
  apiUrl: string,
  apiKey: string,
): EvolutionHttpClient => new EvolutionHttpClient(apiUrl, apiKey)
