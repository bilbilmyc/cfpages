import { handle } from 'hono/cloudflare-pages';
import api from './app';

export const onRequest = handle(api);
