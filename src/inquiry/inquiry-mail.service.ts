import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

interface InquiryMailPayload {
  inquiryId: string;
  title: string;
  content: string;
  userEmail: string;
  createdAt: Date;
}

interface InquiryAnswerMailPayload {
  inquiryId: string;
  title: string;
  adminReply: string;
  userEmail: string;
  answeredAt: Date;
}

const FIXED_SUPPORT_EMAIL = 'rhkdqhr90@gmail.com';

@Injectable()
export class InquiryMailService {
  private readonly logger = new Logger(InquiryMailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromEmail: string | null;
  private readonly supportEmail: string | null;

  constructor(private readonly configService: ConfigService) {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPortRaw = this.configService.get<string>('SMTP_PORT');
    const smtpSecureRaw = this.configService.get<string>('SMTP_SECURE');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    this.fromEmail = this.configService.get<string>('MAIL_FROM') ?? null;
    this.supportEmail = FIXED_SUPPORT_EMAIL;

    if (!smtpHost || !this.fromEmail) {
      this.transporter = null;
      this.logger.warn(
        'SMTP_HOST / MAIL_FROM missing - inquiry email delivery disabled',
      );
      return;
    }

    const smtpPort = Number(smtpPortRaw ?? '587');
    const smtpSecure =
      smtpSecureRaw === 'true' || smtpSecureRaw === '1' || smtpPort === 465;

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth:
        smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  }

  async sendInquiryCreatedEmails(payload: InquiryMailPayload): Promise<void> {
    if (!this.transporter || !this.fromEmail || !this.supportEmail) {
      return;
    }

    const supportSubject = `[NearPrice] 신규 문의 접수 - ${payload.title}`;
    const supportText = [
      '새 문의가 접수되었습니다.',
      '',
      `문의 ID: ${payload.inquiryId}`,
      `작성자 이메일: ${payload.userEmail}`,
      `접수 시간: ${payload.createdAt.toISOString()}`,
      '',
      `[제목] ${payload.title}`,
      payload.content,
    ].join('\n');

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: this.supportEmail,
        subject: supportSubject,
        text: supportText,
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send inquiry mail to support for ${payload.inquiryId}`,
        (error as Error)?.message,
      );
    }

    if (this.isPseudoKakaoFallbackEmail(payload.userEmail)) {
      return;
    }

    const userSubject = '[NearPrice] 문의가 접수되었습니다';
    const userText = [
      '안녕하세요. NearPrice입니다.',
      '',
      '문의가 정상적으로 접수되었습니다. 빠르게 확인 후 답변드리겠습니다.',
      '',
      `[문의 제목] ${payload.title}`,
      `[접수 번호] ${payload.inquiryId}`,
      `[접수 시간] ${payload.createdAt.toISOString()}`,
      '',
      '본 메일은 발신전용입니다.',
    ].join('\n');

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: payload.userEmail,
        subject: userSubject,
        text: userText,
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send inquiry receipt mail to user for ${payload.inquiryId}`,
        (error as Error)?.message,
      );
    }
  }

  async sendInquiryAnsweredEmail(
    payload: InquiryAnswerMailPayload,
  ): Promise<void> {
    if (!this.transporter || !this.fromEmail) {
      return;
    }

    if (this.isPseudoKakaoFallbackEmail(payload.userEmail)) {
      return;
    }

    const userSubject = '[NearPrice] 문의 답변이 등록되었습니다';
    const userText = [
      '안녕하세요. NearPrice입니다.',
      '',
      '문의에 대한 답변이 등록되었습니다.',
      '',
      `[문의 제목] ${payload.title}`,
      `[문의 번호] ${payload.inquiryId}`,
      `[답변 시각] ${payload.answeredAt.toISOString()}`,
      '',
      '[답변 내용]',
      payload.adminReply,
      '',
      '본 메일은 발신전용입니다.',
    ].join('\n');

    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: payload.userEmail,
        subject: userSubject,
        text: userText,
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to send inquiry answer mail to user for ${payload.inquiryId}`,
        (error as Error)?.message,
      );
    }
  }

  private isPseudoKakaoFallbackEmail(email: string): boolean {
    return email.startsWith('kakao_') && email.endsWith('@nearprice.app');
  }
}
