import { importJWK, jwtVerify } from 'jose';

import { checkAuthWithProvider } from '@/app/api/chat/[provider]/checkAuthWithProvider';
import { getPreferredRegion } from '@/app/api/config';
import { createErrorResponse } from '@/app/api/errorResponse';
import { JWTPayload, JWT_SECRET_KEY, LOBE_AI_PROVIDER_AUTH } from '@/const/fetch';
import {
  AgentRuntimeError,
  ChatCompletionErrorPayload,
  ILobeAgentRuntimeErrorType,
} from '@/libs/agent-runtime';
import { ChatErrorType } from '@/types/fetch';
import { ChatStreamPayload } from '@/types/openai/chat';

import AgentRuntime from './agentRuntime';

// due to the Chinese region does not support accessing Google / OpenAI
// we need to use proxy to access it
// refs: https://github.com/google/generative-ai-js/issues/29#issuecomment-1866246513
const proxyUrl = process.env.HTTP_PROXY_URL;
const useProxy = !!proxyUrl;

if (useProxy) {
  const { setGlobalDispatcher, ProxyAgent } = require('undici');

  setGlobalDispatcher(new ProxyAgent({ uri: proxyUrl }));
}
// undici only can be used in NodeJS.
// So when using proxy, switch to NodeJS runtime
export const runtime = useProxy ? 'nodejs' : 'edge';

export const preferredRegion = getPreferredRegion();

const getJWTPayload = async (token: string) => {
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.digest('SHA-256', encoder.encode(JWT_SECRET_KEY));

  const jwkSecretKey = await importJWK(
    { k: Buffer.from(secretKey).toString('base64'), kty: 'oct' },
    'HS256',
  );

  const { payload } = await jwtVerify(token, jwkSecretKey);

  return payload as JWTPayload;
};

export const POST = async (req: Request, { params }: { params: { provider: string } }) => {
  let agentRuntime: AgentRuntime;

  // ============  1. init chat model   ============ //

  try {
    // get Authorization from header
    const authorization = req.headers.get(LOBE_AI_PROVIDER_AUTH);
    if (!authorization) throw AgentRuntimeError.createError(ChatErrorType.Unauthorized);

    // check the Auth With payload
    const payload = await getJWTPayload(authorization);
    checkAuthWithProvider(payload);

    agentRuntime = await AgentRuntime.initFromRequest(params.provider, payload, req.clone());
  } catch (e) {
    // if catch the error, just return it
    const err = JSON.parse((e as Error).message) as { type: ILobeAgentRuntimeErrorType };

    return createErrorResponse(err.type);
  }

  // ============  2. create chat completion   ============ //

  try {
    const payload = (await req.json()) as ChatStreamPayload;

    return await agentRuntime.chat(payload);
  } catch (e) {
    const { errorType, provider, error: errorContent, ...res } = e as ChatCompletionErrorPayload;

    // track the error at server side
    console.error(`Route: [${provider}] ${errorType}:`, errorContent);

    return createErrorResponse(errorType, { error: errorContent, provider, ...res });
  }
};
