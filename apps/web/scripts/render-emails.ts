
import { render } from '@react-email/render';
import * as fs from 'fs';
import * as path from 'path';

// Import templates
import { InviteUserEmail } from '../emails/invite-user';
import { VerifyEmail } from '../emails/verify-email';
import { PasswordReset } from '../emails/password-reset';
import { WaitlistConfirmationEmail } from '../emails/waitlist-confirmation';

async function renderTemplates() {
  const outDir = path.join(process.cwd(), 'email-html-output');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
  }

  // 1. Invite User
  const inviteHtml = await render(InviteUserEmail({ inviteLink: '{{inviteLink}}' }));
  fs.writeFileSync(path.join(outDir, 'invite-user.html'), inviteHtml);
  console.log('Rendered invite-user.html');

  // 2. Verify Email
  const verifyHtml = await render(VerifyEmail({ confirmationLink: '{{confirmationLink}}' }));
  fs.writeFileSync(path.join(outDir, 'verify-email.html'), verifyHtml);
  console.log('Rendered verify-email.html');

  // 3. Password Reset
  const resetHtml = await render(PasswordReset({ resetLink: '{{resetLink}}' }));
  fs.writeFileSync(path.join(outDir, 'password-reset.html'), resetHtml);
  console.log('Rendered password-reset.html');

  // 4. Waitlist
  const waitlistHtml = await render(WaitlistConfirmationEmail());
  fs.writeFileSync(path.join(outDir, 'waitlist-confirmation.html'), waitlistHtml);
  console.log('Rendered waitlist-confirmation.html');
}

renderTemplates().catch(console.error);
