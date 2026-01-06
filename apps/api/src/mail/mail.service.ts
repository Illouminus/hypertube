import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly frontendUrl: string;
  private readonly transporter: Transporter | null = null;
  private readonly smtpConfigured: boolean;
  private readonly smtpFrom: string;

  constructor(private readonly configService: ConfigService) {
    this.frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    // SMTP configuration
    const smtpHost = this.configService.get<string>('SMTP_HOST', '');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 587);
    const smtpUser = this.configService.get<string>('SMTP_USER', '');
    const smtpPass = this.configService.get<string>('SMTP_PASS', '');
    this.smtpFrom = this.configService.get<string>(
      'SMTP_FROM',
      'noreply@hypertube.local',
    );

    // Check if SMTP is configured
    this.smtpConfigured = !!(smtpHost && smtpUser && smtpPass);

    if (this.smtpConfigured) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.logger.log(`SMTP configured: ${smtpHost}:${smtpPort}`);
    } else {
      this.logger.warn(
        'SMTP not configured. Emails will be logged to console only.',
      );
    }
  }

  /**
   * Send password reset email.
   * Uses SMTP when configured, otherwise logs to console.
   */
  async sendPasswordResetEmail(
    email: string,
    token: string,
    username: string,
  ): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password?token=${token}`;

    // Always log in development
    this.logEmailToConsole(email, username, resetUrl);

    // Send via SMTP if configured
    if (this.smtpConfigured && this.transporter) {
      try {
        await this.transporter.sendMail({
          from: this.smtpFrom,
          to: email,
          subject: 'Reset your Hypertube password',
          html: this.getPasswordResetEmailHtml(username, resetUrl),
          text: this.getPasswordResetEmailText(username, resetUrl),
        });
        this.logger.log(`Password reset email sent to: ${email}`);
      } catch (error) {
        this.logger.error(`Failed to send password reset email to ${email}:`, error);
        // Don't throw - we still logged the link so user can test
      }
    }
  }

  /**
   * Log email to console (development fallback)
   */
  private logEmailToConsole(
    email: string,
    username: string,
    resetUrl: string,
  ): void {
    this.logger.log('='.repeat(60));
    this.logger.log('PASSWORD RESET EMAIL');
    this.logger.log('='.repeat(60));
    this.logger.log(`To: ${email}`);
    this.logger.log(`Username: ${username}`);
    this.logger.log(`Reset URL: ${resetUrl}`);
    this.logger.log('='.repeat(60));
  }

  /**
   * Get HTML content for password reset email
   */
  private getPasswordResetEmailHtml(username: string, resetUrl: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f0f23;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="text-align: center; padding-bottom: 30px;">
        <h1 style="color: #e94560; margin: 0; font-size: 32px;">Hypertube</h1>
      </td>
    </tr>
    <tr>
      <td style="background-color: #1a1a2e; border-radius: 12px; padding: 40px;">
        <h2 style="color: #ffffff; margin: 0 0 20px 0; font-size: 24px;">Reset Your Password</h2>
        <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
          Hello <strong style="color: #ffffff;">${username}</strong>,
        </p>
        <p style="color: #a0a0a0; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
          We received a request to reset your password. Click the button below to create a new password:
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="text-align: center;">
              <a href="${resetUrl}" style="display: inline-block; background-color: #e94560; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Reset Password
              </a>
            </td>
          </tr>
        </table>
        <p style="color: #a0a0a0; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
          This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="text-align: center; padding-top: 30px;">
        <p style="color: #666666; font-size: 12px; margin: 0;">
          © ${new Date().getFullYear()} Hypertube. All rights reserved.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  /**
   * Get plain text content for password reset email
   */
  private getPasswordResetEmailText(username: string, resetUrl: string): string {
    return `
Hypertube - Reset Your Password

Hello ${username},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

© ${new Date().getFullYear()} Hypertube. All rights reserved.
    `.trim();
  }
}
