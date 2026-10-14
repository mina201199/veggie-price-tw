import { env } from 'cloudflare:workers';
import { handleCloudRequest } from '../../../../lib/cloud-notes-server.mjs';

type Context = { params: Promise<{ path: string[] }> };

async function route(request: Request, context: Context) {
  const { path } = await context.params;
  return handleCloudRequest(request, env, path);
}

export const GET = route;
export const PUT = route;
export const DELETE = route;
