import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import * as Sentry from '@sentry/nestjs';

// 앱이 화면 분기에 사용하는 표준 에러 코드. statusCode에서 자동 추론하되 throw 시 명시적으로 override 가능.
const STATUS_TO_CODE: Record<number, string> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHORIZED',
  403: 'TOKEN_INVALID',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const isProduction = process.env.NODE_ENV === 'production';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      const body =
        typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? (exceptionResponse as {
              statusCode?: number;
              message?: unknown;
              error?: string;
              code?: string;
            })
          : { message: String(exceptionResponse) };

      const rawMessage = body.message ?? body.error;
      const message = Array.isArray(rawMessage)
        ? isProduction
          ? '입력값이 올바르지 않습니다.'
          : rawMessage.join(', ')
        : (rawMessage ?? '요청 처리 중 오류가 발생했습니다.');

      const code = body.code ?? STATUS_TO_CODE[status] ?? 'UNKNOWN';

      return response.status(status).json({
        statusCode: status,
        code,
        message,
        timestamp: new Date().toISOString(),
      });
    }

    // 예상치 못한 에러는 500으로 처리 + Sentry 보고
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(exception);
    }
    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    return response.status(status).json({
      statusCode: status,
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      timestamp: new Date().toISOString(),
      ...(isProduction ? {} : { error: (exception as Error).message }),
    });
  }
}
