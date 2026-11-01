// Keep the browser and API on the same origin; forward the Access assertion to
// the Worker. Access-token validation can be enabled there later.
interface Env { CASHBACK_API: { fetch(request: Request): Promise<Response> } }
export const onRequest = ({ request, env }: { request: Request; env: Env }): Promise<Response> => env.CASHBACK_API.fetch(request);
