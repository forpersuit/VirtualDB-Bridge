import nodemailer from 'nodemailer';
import { config } from './config';
import { vmailPool } from './db';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.password,
  },
  tls: {
    rejectUnauthorized: false
  }
});

export async function sendTenantEmail(to: string | string[], subject: string, html: string, text: string, fromUsername?: string, fromName?: string) {
  let senderEmail = config.smtp.user;
  let senderName = 'Notification Service';

  if (fromUsername) {
    const [rows] = await vmailPool.execute('SELECT username FROM mailbox WHERE username = ? AND active = 1', [fromUsername]);
    if ((rows as any[]).length === 0) {
      throw new Error(`Sender email ${fromUsername} does not exist or is inactive`);
    }
    senderEmail = fromUsername;
  }

  if (fromName) {
    senderName = fromName;
  }

  const info = await transporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    to: Array.isArray(to) ? to.join(',') : to,
    subject: subject,
    text: text,
    html: html,
  });

  return info;
}
