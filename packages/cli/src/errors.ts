export class CliValidationError extends Error {
  readonly exitCode = 2
  constructor(
    message: string,
    readonly details?: { code: string; path?: string; [key: string]: unknown },
  ) {
    super(message)
    this.name = 'CliValidationError'
  }
}

export class CliConfigError extends Error {
  readonly exitCode = 3
  constructor(
    message: string,
    readonly details?: { code: string; [key: string]: unknown },
  ) {
    super(message)
    this.name = 'CliConfigError'
  }
}

export class CliUnsupportedAdapterError extends CliValidationError {
  constructor(adapter: string) {
    super(
      `Adapter '${adapter}' is not supported. Use 'sqlite' or 'postgres' instead.`,
      { code: 'UNSUPPORTED_ADAPTER', adapter },
    )
    this.name = 'CliUnsupportedAdapterError'
  }
}

export class CliNotImplementedError extends Error {
  readonly exitCode = 2
  constructor(
    message: string,
    readonly details?: { code: string; dependency?: string; [key: string]: unknown },
  ) {
    super(message)
    this.name = 'CliNotImplementedError'
  }
}
