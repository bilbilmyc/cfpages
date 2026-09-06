import { HttpError, json, type Env } from '../../server/http';
export const onRequest: PagesFunction<Env> = async (context) => {
  try {
    return await context.next();
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error('API failure', error instanceof Error ? error.name : 'Unknown');
    return json({ error: '服务暂时不可用，请确认数据库迁移已执行，稍后重试。' }, 500);
  }
};
