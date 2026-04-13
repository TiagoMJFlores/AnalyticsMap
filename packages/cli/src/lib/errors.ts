export class AnalyticsMapError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "AnalyticsMapError";
  }
}

export class ConfigError extends AnalyticsMapError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class ScanError extends AnalyticsMapError {
  constructor(message: string) {
    super(message, "SCAN_ERROR");
    this.name = "ScanError";
  }
}

export class LLMError extends AnalyticsMapError {
  constructor(message: string) {
    super(message, "LLM_ERROR");
    this.name = "LLMError";
  }
}
