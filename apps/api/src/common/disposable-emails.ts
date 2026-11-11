// Tek kullanımlık / geçici e-posta servisleri. Sahte hesap açılmasını zorlaştırmak için kayıtta engellenir.
// Liste kısadır; zamanla güncellenir.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com',
  '10minutemail.com', '10minutemail.net', 'temp-mail.org', 'tempmail.com', 'tempmail.net',
  'tempmailo.com', 'tempail.com', 'throwawaymail.com', 'yopmail.com', 'yopmail.net', 'yopmail.fr',
  'getnada.com', 'nada.email', 'trashmail.com', 'trashmail.net', 'trashmail.de', 'maildrop.cc',
  'dispostable.com', 'fakeinbox.com', 'mailnesia.com', 'mintemail.com', 'moakt.com', 'mohmal.com',
  'emailondeck.com', 'burnermail.io', 'spamgourmet.com', 'mytemp.email', 'tmail.ws', 'tmpmail.org',
  'tmpmail.net', 'discard.email', 'grr.la', 'guerrillamailblock.com', 'inboxkitten.com', 'mail.tm',
  'emailfake.com', 'fake-mail.net', 'harakirimail.com', 'mailcatch.com', 'mvrht.com', 'spambox.us',
  'anonbox.net', '33mail.com', 'owlymail.com', 'temp-mail.io', 'tempr.email', 'instaddr.win',
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain !== undefined && DISPOSABLE_DOMAINS.has(domain);
}
