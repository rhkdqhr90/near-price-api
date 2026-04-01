import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const isProduction = process.env.NODE_ENV === 'production';

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // HttpException 응답에서 민감한 정보 필터링
      let responseBody: unknown = exceptionResponse;
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        responseBody = { ...exceptionResponse };
        // 프로덕션 환경에서는 message만 유지하고 불필요한 정보 제거
        if (isProduction) {
          const body = exceptionResponse as {
            statusCode?: number;
            message?: unknown;
            error?: string;
          };
          // class-validator 에러는 message가 배열로 오므로 프로덕션에서 상세 노출 방지
          const rawMessage = body.message ?? body.error;
          const message = Array.isArray(rawMessage)
            ? '입력값이 올바르지 않습니다.'
            : (rawMessage ?? '요청 처리 중 오류가 발생했습니다.');
          responseBody = {
            statusCode: body.statusCode,
            message,
            timestamp: new Date().toISOString(),
          };
        }
      }

      return response.status(status).json(responseBody);
    }

    // 예상치 못한 에러는 500으로 처리 + Sentry 보고
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(exception);
    }
    const status = HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      message: 'Internal server error',
      ...(isProduction ? {} : { error: (exception as Error).message }),
    };

    return response.status(status).json(errorResponse);
  }
}
