import { env } from 'cloudflare:workers';
import { handleSystemBackup } from '../../../../lib/system-backup.mjs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => handleSystemBackup(request, env);
export const POST = GET;
export const PUT = GET;
export const DELETE = GET;
