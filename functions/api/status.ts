import { json, type Env } from '../../server/http';
export const onRequestGet: PagesFunction<Env> = async ({ env }) =>
  json({
    configured: Boolean(env.DB && env.IMAGES && env.ADMIN_TOKEN && env.ADMIN_TOKEN.length >= 32),
  });
