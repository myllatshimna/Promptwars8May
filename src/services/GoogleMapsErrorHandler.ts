export class GoogleMapsAPIError extends Error {
  public statusCode: number;
  public grpcStatus?: string;
  public details: any;

  constructor(message: string, statusCode: number, grpcStatus?: string, details?: any) {
    super(message);
    this.name = 'GoogleMapsAPIError';
    this.statusCode = statusCode;
    this.grpcStatus = grpcStatus;
    this.details = details;
    Object.setPrototypeOf(this, GoogleMapsAPIError.prototype);
  }
}

export class GoogleMapsErrorHandler {
  /**
   * Translates common Axios errors or Google API errors into standard application errors.
   */
  public static handleError(error: any): never {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const status = error.response.status;
      const data = error.response.data;
      
      const grpcStatus = data?.error?.status || 'UNKNOWN';
      const message = data?.error?.message || error.message;
      const details = data?.error?.details || [];

      switch (status) {
        case 400:
          throw new GoogleMapsAPIError(`Invalid Argument: ${message}`, 400, grpcStatus, details);
        case 403:
          throw new GoogleMapsAPIError(`Permission Denied or Quota Exceeded: ${message}`, 403, grpcStatus, details);
        case 404:
          throw new GoogleMapsAPIError(`Resource Not Found: ${message}`, 404, grpcStatus, details);
        case 429:
          throw new GoogleMapsAPIError(`Rate Limit Exceeded (Resource Exhausted): ${message}`, 429, grpcStatus, details);
        case 500:
        case 503:
        case 504:
          throw new GoogleMapsAPIError(`Google Maps API Server Error: ${message}`, status, grpcStatus, details);
        default:
          throw new GoogleMapsAPIError(`Google Maps API Error: ${message}`, status, grpcStatus, details);
      }
    } else if (error.request) {
      // The request was made but no response was received (network error, timeout)
      throw new GoogleMapsAPIError('Network Error: No response received from Google Maps API', 503, 'UNAVAILABLE');
    } else {
      // Something happened in setting up the request
      throw new GoogleMapsAPIError(`Client Error: ${error.message}`, 500, 'INTERNAL');
    }
  }
}
