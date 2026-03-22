import { API_CONFIG, buildApiUrl } from '../config/apiConfig';

const DEFAULT_TIMEOUT_MS = API_CONFIG.TIMEOUT;

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const logApiFailure = ({ endpoint, fullUrl, method, statusCode, responseBody, error }) => {
  console.error(`[API] Request failed endpoint=${endpoint}`);
  console.error(`[API] Full URL: ${fullUrl}`);
  console.error(`[API] Method: ${method}`);
  if (statusCode != null) {
    console.error(`[API] Status: ${statusCode}`);
  }
  if (responseBody != null && responseBody !== '') {
    console.error('[API] Response Body:', responseBody);
  }
  console.error('[API] Error Message:', error?.message || String(error));
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const requestJson = async (endpoint, options = {}) => {
  const method = options.method || 'GET';
  const fullUrl = buildApiUrl(endpoint);

  try {
    const response = await fetchWithTimeout(fullUrl, options, options.timeoutMs);

    if (response.status === 204) {
      return { data: null, response, status: response.status };
    }

    const rawBody = await response.text();
    const parsedBody = safeJsonParse(rawBody);

    if (!response.ok) {
      const err = new Error(
        parsedBody?.detail || parsedBody?.message || `API Error: ${response.status}`
      );
      err.status = response.status;
      err.body = parsedBody ?? rawBody;
      logApiFailure({
        endpoint,
        fullUrl,
        method,
        statusCode: response.status,
        responseBody: err.body,
        error: err,
      });
      throw err;
    }

    return {
      data: parsedBody ?? rawBody,
      response,
      status: response.status,
    };
  } catch (error) {
    const isAbort = error?.name === 'AbortError';
    const wrappedError = isAbort
      ? new Error(`Request timed out after ${options.timeoutMs || DEFAULT_TIMEOUT_MS}ms`)
      : error;

    logApiFailure({
      endpoint,
      fullUrl,
      method,
      statusCode: error?.status,
      responseBody: error?.body,
      error: wrappedError,
    });

    throw wrappedError;
  }
};

export const requestFormData = async (endpoint, formData, options = {}) => {
  const method = options.method || 'POST';
  const fullUrl = buildApiUrl(endpoint);

  try {
    const response = await fetchWithTimeout(
      fullUrl,
      {
        method,
        headers: options.headers || {},
        body: formData,
      },
      options.timeoutMs
    );

    const rawBody = await response.text();
    const parsedBody = safeJsonParse(rawBody);

    if (!response.ok) {
      const err = new Error(
        parsedBody?.detail || parsedBody?.message || `Upload Error: ${response.status}`
      );
      err.status = response.status;
      err.body = parsedBody ?? rawBody;
      logApiFailure({
        endpoint,
        fullUrl,
        method,
        statusCode: response.status,
        responseBody: err.body,
        error: err,
      });
      throw err;
    }

    return {
      data: parsedBody ?? rawBody,
      response,
      status: response.status,
    };
  } catch (error) {
    const isAbort = error?.name === 'AbortError';
    const wrappedError = isAbort
      ? new Error(`Request timed out after ${options.timeoutMs || DEFAULT_TIMEOUT_MS}ms`)
      : error;

    logApiFailure({
      endpoint,
      fullUrl,
      method,
      statusCode: error?.status,
      responseBody: error?.body,
      error: wrappedError,
    });

    throw wrappedError;
  }
};
