import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private transporter: nodemailer.Transporter;
    private readonly logger = new Logger(MailService.name);

    constructor(private configService: ConfigService) {
        this.transporter = nodemailer.createTransport({
            host: this.configService.get<string>('SMTP_HOST'),
            port: this.configService.get<number>('SMTP_PORT'),
            auth: {
                user: this.configService.get<string>('SMTP_USER'),
                pass: this.configService.get<string>('SMTP_PASS'),
            },
        });
    }

    async sendPasswordResetEmail(to: string, token: string) {
        const frontendUrl = this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
        const resetLink = `${frontendUrl}/reset-password?token=${token}`;

        try {
            await this.transporter.sendMail({
                from: this.configService.get<string>('SMTP_FROM'),
                to,
                subject: 'Hypertube - Password Reset Request',
                html: `
                    <h1>Password Reset</h1>
                    <p>You requested a password reset. Click the link below to set a new password:</p>
                    <a href="${resetLink}">Reset Password</a>
                    <p>If you didn't request this, please ignore this email. The link will expire in 1 hour.</p>
                `,
            });
            this.logger.log(`Password reset email sent to ${to}`);
        } catch (error) {
            this.logger.error(`Failed to send email to ${to}`, error.stack);
            // Handle email sending failure (e.g., log the error, retry logic, etc.)
        }
    }
}
