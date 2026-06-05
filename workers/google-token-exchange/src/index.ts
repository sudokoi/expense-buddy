interface TokenExchangeRequest {
  grant_type: "authorization_code" | "refresh_token"
  code?: string
  refresh_token?: string
}

interface TokenExchangeResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

interface TokenRefreshResponse {
  access_token: string
  expires_in?: number
}

interface Env {
  CLIENT_ID: string
  CLIENT_SECRET: string
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 })
    }

    const clientId = env.CLIENT_ID
    const clientSecret = env.CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          error: "server_misconfigured",
          error_description: "OAuth credentials not configured",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    let body: TokenExchangeRequest
    try {
      body = await request.json()
    } catch {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          error_description: "Invalid JSON body",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    if (body.grant_type === "authorization_code") {
      if (!body.code) {
        return new Response(
          JSON.stringify({ error: "invalid_request", error_description: "Missing code" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      const params = new URLSearchParams({
        code: body.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: "",
        grant_type: "authorization_code",
      })

      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      })

      const data: TokenExchangeResponse = await response.json()
      if (!response.ok || !data.access_token) {
        return new Response(JSON.stringify(data), {
          status: response.ok ? 400 : response.status,
          headers: { "Content-Type": "application/json" },
        })
      }

      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      })
    }

    if (body.grant_type === "refresh_token") {
      if (!body.refresh_token) {
        return new Response(
          JSON.stringify({
            error: "invalid_request",
            error_description: "Missing refresh_token",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      const params = new URLSearchParams({
        refresh_token: body.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      })

      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      })

      const data: TokenRefreshResponse = await response.json()
      if (!response.ok || !data.access_token) {
        return new Response(JSON.stringify(data), {
          status: response.ok ? 400 : response.status,
          headers: { "Content-Type": "application/json" },
        })
      }

      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ error: "unsupported_grant_type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  },
}
