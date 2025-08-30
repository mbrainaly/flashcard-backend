import nodemailer from 'nodemailer'

export function createTransport() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT || 465)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!user || !pass) {
    throw new Error('SMTP credentials are not configured')
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: { user, pass },
  })
}

export async function sendMail(options: { to: string; subject: string; html: string; text?: string; fromName?: string }) {
  const transporter = createTransport()
  const fromEmail = process.env.SMTP_FROM || options.fromName ? `${options.fromName} <${process.env.SMTP_USER}>` : process.env.SMTP_USER!
  await transporter.sendMail({
    from: fromEmail,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  })
}


