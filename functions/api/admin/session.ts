import { json, type Env } from '../../../server/http';
// Parent middleware validates the administrator token before this handler runs.
export const onRequestGet: PagesFunction<Env> = () => json({ authenticated: true });
