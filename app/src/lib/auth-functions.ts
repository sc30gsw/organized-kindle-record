import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth, isAllowedEmail } from '@/lib/auth';

export const getSession = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session || !isAllowedEmail(session.user.email)) {
    return null;
  }

  return session;
});

export const ensureSession = createServerFn({ method: 'GET' }).handler(async () => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });

  if (!session || !isAllowedEmail(session.user.email)) {
    throw new Error('Unauthorized');
  }

  return session;
});
