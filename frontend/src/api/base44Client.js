import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  appBaseUrl
});

// The SDK's functions.invoke rejects on any non-2xx response with a generic
// axios error ("Request failed with status code 400"). These two helpers give
// every caller the server's own error message instead.

// Always resolves to { status, data }, for callers that branch on
// `res.status >= 400` and show `res.data.error`. Network failures still throw.
export async function invokeFunction(name, payload = {}) {
  try {
    const res = await base44.functions.invoke(name, payload);
    return { status: res.status, data: res.data };
  } catch (error) {
    if (error && error.response) return { status: error.response.status, data: error.response.data || {} };
    throw error;
  }
}

// Resolves to the response data, or throws an Error carrying the server's
// message. For try/catch callers and React Query fetchers.
export async function callFunction(name, payload = {}) {
  const res = await invokeFunction(name, payload);
  if (res.status >= 400) {
    const message = (res.data && res.data.error) || `Request failed (${res.status}).`;
    throw Object.assign(new Error(message), { status: res.status, data: res.data });
  }
  return res.data;
}
