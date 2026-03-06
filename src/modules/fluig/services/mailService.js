const nodemailer = require('nodemailer');
const { env } = require('../config/env');

function createTransporter() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

async function sendAuditMail({ subject, content }) {
  const transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: env.MAIL_FROM,
      to: env.MAIL_TO,
      subject,
      text: content,
    });
  } catch (error) {
    console.error('[fluig-mail] send failure', {
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack,
    });

    const mailError = new Error('mail_failed');
    mailError.statusCode = 500;
    mailError.publicMessage = 'mail_failed';
    throw mailError;
  }
}

module.exports = {
  sendAuditMail,
};
