type ErrorField = 'message' | 'detail';

export function getApiErrorMessage(error: unknown, field: ErrorField, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const response = (error as { response?: { data?: Record<string, unknown> } }).response;
    const responseMessage = response?.data?.[field];
    if (typeof responseMessage === 'string') {
      return responseMessage;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}