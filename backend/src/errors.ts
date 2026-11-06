// AppError: a stable machine-readable `code` plus optional structured detail.

import type { FastifyReply, FastifyRequest } from "fastify";

export class AppError extends Error {
  status: number;
  code: string;
  detail?: Record<string, unknown>;

  constructor(status: number, code: string, detail?: Record<string, unknown>) {
    super(code);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }

  static badRequest(code: string, detail?: Record<string, unknown>): AppError {
    return new AppError(400, code, detail);
  }
  static notFound(): AppError {
    return new AppError(404, "not_found");
  }
  static unauthorized(message: string): AppError {
    return new AppError(401, message);
  }
  static upstream(): AppError {
    return new AppError(502, "upstream_error");
  }
}

export function errorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply): void {
  if (error instanceof AppError) {
    reply.status(error.status).send({ error: error.code, ...(error.detail ?? {}) });
    return;
  }

  // Fastify's own errors (malformed JSON body, payload too large, etc.)
  // carry a statusCode; anything else is an unexpected internal failure.
  const fastifyStatus = (error as { statusCode?: number }).statusCode;
  if (typeof fastifyStatus === "number" && fastifyStatus >= 400 && fastifyStatus < 500) {
    reply.status(fastifyStatus).send({ error: "bad_request" });
    return;
  }

  request.log.error(error, "internal server error");
  reply.status(500).send({ error: "internal_server_error" });
}
