import nodemailer from 'nodemailer';
import config from '../config/index.js';

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: config.smtp_user,
    pass: config.smtp_password,
  },
});

// Fails fast on boot if SMTP creds are wrong, instead of failing silently
// on the first user's registration attempt.
transporter.verify((err) => {
  if (err) {
    console.error('SMTP transporter verification failed:', err.message);
  } else {
    console.log('SMTP transporter ready');
  }
});
