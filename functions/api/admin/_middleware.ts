import { authorize, type Env } from '../../../server/http';
export const onRequest: PagesFunction<Env> = async (context) => {
  await authorize(context.request, context.env);
  return context.next();
};
