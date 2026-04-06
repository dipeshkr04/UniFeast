const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error('SMTP credentials are missing. Set SMTP_USER and SMTP_PASS.');
  }

  transporter = nodemailer.createTransport({
    service: process.env.SMTP_SERVICE || 'gmail',
    auth: {
      user,
      pass
    }
  });

  return transporter;
}

async function sendLoginOtpEmail({ to, otpCode, expiryMinutes = 5 }) {
  const sender = process.env.MAIL_FROM || process.env.SMTP_USER;
  const mailer = getTransporter();

  await mailer.sendMail({
    from: sender,
    to,
    subject: 'Your Login OTP Code',
    text: `Your OTP is ${otpCode}. It is valid for ${expiryMinutes} minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
        <h2 style="margin:0 0 12px;">Login verification code</h2>
        <p style="margin:0 0 12px;">Use this OTP to complete your login:</p>
        <div style="font-size:28px;font-weight:700;letter-spacing:4px;margin:8px 0 14px;">${otpCode}</div>
        <p style="margin:0;">This code expires in ${expiryMinutes} minutes.</p>
      </div>
    `
  });
}

module.exports = {
  sendLoginOtpEmail
};
