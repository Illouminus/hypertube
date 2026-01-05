import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
  }

  /**
   * Send password reset email.
   * In development mode, this just logs the reset link to the console.
   * In production, this would send an actual email via SMTP/SendGrid/etc.
   */
  async sendPasswordResetEmail(
    email: string,
    token: string,
    username: string,
  ): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;

    // Development mode: log to console
    this.logger.log('='.repeat(60));
    this.logger.log('PASSWORD RESET EMAIL (Development Mode)');
    this.logger.log('='.repeat(60));
    this.logger.log(`To: ${email}`);
    this.logger.log(`Username: ${username}`);
    this.logger.log(`Reset URL: ${resetUrl}`);
    this.logger.log('='.repeat(60));

    // In production, implement actual email sending:
    // await this.sendEmail({
    //   to: email,
    //   subject: 'Reset your Hypertube password',
    //   html: `<p>Hello ${username},</p><p>Click <a href="${resetUrl}">here</a> to reset your password.</p>`,
    // });
  }
}
