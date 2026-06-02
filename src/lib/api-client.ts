const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api/v1";

export type ApiClientOptions = RequestInit & {
  token?: string;
  isFormData?: boolean;
};

export class ApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiClient<TResponse>(path: string, options: ApiClientOptions = {}) {
  const { token, headers, isFormData = false, ...requestOptions } = options;

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...requestOptions,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    }
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;

    throw new ApiError(errorBody?.message ?? `API request failed with status ${response.status}`, response.status);
  }

  return (await response.json()) as TResponse;
}

export type ApiResponse<TData, TMeta = unknown> = {
  success: boolean;
  message: string;
  data: TData;
  meta?: TMeta;
};
