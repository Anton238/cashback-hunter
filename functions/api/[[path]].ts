// Keep session cookies and API calls on the same origin; the Worker validates
// the access-code session and, when configured, Cloudflare Access.
interface Env { CASHBACK_API: { fetch(request: Request): Promise<Response> } }
export const onRequest = ({ request, env }: { request: Request; env: Env }): Promise<Response> => env.CASHBACK_API.fetch(request);
