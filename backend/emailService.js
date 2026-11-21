const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

async function sendPasswordSetupEmail(email, link) {
  return transporter.sendMail({
    from: `"CampusOS Admin" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Activate your CampusOS student account",
    text: `Your student account has been approved.

Open this secure link to set your password:
${link}

If you did not expect this email, please contact your college administrator.`
  });
}

module.exports = { transporter, sendPasswordSetupEmail };
