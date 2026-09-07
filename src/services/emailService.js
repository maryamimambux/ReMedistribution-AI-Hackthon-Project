/**
 * Email Service — Real email delivery via SendGrid or SMTP (Gmail, Outlook, etc.)
 *
 * Priority:
 *   1. SendGrid API if SENDGRID_API_KEY is set.
 *   2. SMTP if SMTP_HOST, SMTP_USER, and SMTP_PASS are set.
 *   3. Console/file fallback in development ONLY so verification codes are not lost.
 *
 * In production, at least one real provider must be configured. The service
 * returns { success, sent, message } so callers can decide whether to fail.
 */

const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'ReMedistribution';

/**
 * Return the correct sender address for the active provider.
 */
function getFromEmail(provider) {
  if (provider === 'sendgrid') return process.env.SENDGRID_FROM_EMAIL || 'noreply@remedistribution.com';
  if (provider === 'smtp') return process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@remedistribution.com';
  return 'noreply@remedistribution.com';
}

// Configure SendGrid if API key is present
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Configure SMTP transport if credentials are present
let smtpTransporter = null;
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  smtpTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Determine which email provider is active.
 */
function getProvider() {
  if (process.env.SENDGRID_API_KEY) return 'sendgrid';
  if (smtpTransporter) return 'smtp';
  return process.env.NODE_ENV === 'production' ? 'none' : 'console';
}

/**
 * Send an email. Returns { success, sent, provider, message }.
 */
async function sendEmail(to, subject, html) {
  const provider = getProvider();

  if (provider === 'none') {
    logger.error({ to, subject }, 'Email not sent: no email provider configured in production');
    return {
      success: false,
      sent: false,
      provider,
      message: 'Email service is not configured. Please set SENDGRID_API_KEY or SMTP credentials.',
    };
  }

  if (provider === 'console') {
    logger.info({ to, subject }, 'Email (development fallback — logged to console)');
    logger.info(`\n========== EMAIL ==========\nTo: ${to}\nSubject: ${subject}\nBody:\n${html}\n===========================\n`);
    return {
      success: true,
      sent: false,
      provider,
      message: 'Email logged to console (no real provider configured).',
    };
  }

  const fromEmail = getFromEmail(provider);

  try {
    if (provider === 'sendgrid') {
      await sgMail.send({
        to,
        from: { email: fromEmail, name: FROM_NAME },
        subject,
        html,
      });
    } else if (provider === 'smtp') {
      await smtpTransporter.sendMail({
        from: `"${FROM_NAME}" <${fromEmail}>`,
        to,
        subject,
        html,
      });
    }

    logger.info({ to, subject, provider }, 'Email sent');
    return { success: true, sent: true, provider, message: 'Email sent successfully.' };
  } catch (err) {
    logger.error({ err, to, subject, provider }, 'Email send failed');
    return {
      success: false,
      sent: false,
      provider,
      message: err.response?.body?.errors?.[0]?.message || err.message || 'Failed to send email.',
    };
  }
}

/**
 * Send email verification code
 */
async function sendVerificationEmail(email, code) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: #065f46; color: white; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">ReMedistribution</h1>
      </div>
      <div style="padding: 32px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
        <h2 style="color: #111827; margin-top: 0;">Verify Your Email</h2>
        <p style="color: #6b7280;">Use this 6-digit code to verify your email address:</p>
        <div style="text-align: center; margin: 32px 0;">
          <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #065f46; background: #ecfdf5; padding: 16px 24px; border-radius: 8px;">${code}</span>
        </div>
        <p style="color: #9ca3af; font-size: 13px;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
      </div>
    </div>
  `;
  return sendEmail(email, 'Verify your email — ReMedistribution', html);
}

/**
 * Send password reset link
 */
async function sendPasswordResetEmail(email, resetLink) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
      <div style="background: #065f46; color: white; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">ReMedistribution</h1>
      </div>
      <div style="padding: 32px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
        <h2 style="color: #111827; margin-top: 0;">Reset Your Password</h2>
        <p style="color: #6b7280;">You requested a password reset. Click the button below:</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" style="background: #065f46; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">Reset Password</a>
        </div>
        <p style="color: #9ca3af; font-size: 13px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    </div>
  `;
  return sendEmail(email, 'Reset your password — ReMedistribution', html);
}

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail };
