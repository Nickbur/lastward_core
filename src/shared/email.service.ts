import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env.js';

/**
 * SMTP transport with a dev-console fallback. When EMAIL_DEV_MODE=true, or no
 * SMTP_HOST is configured, mail is printed to the console instead of sent — so a
 * self-hosted instance warns + fires end-to-end out of the box with no provider.
 * Configure SMTP_* to deliver real mail.
 *
 * The core ships NO push (OneSignal) or SMS (Twilio) integration by design: those
 * channels are logged to the console so a self-hoster can wire their own provider
 * without the core carrying third-party SDKs. Email is the channel that works
 * standalone, and it is the one that actually carries the release link.
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
    if (env.EMAIL_DEV_MODE || !env.SMTP_HOST) return null;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
        });
    }
    return transporter;
}

interface SendOpts {
    to: string;
    subject: string;
    html: string;
    text: string;
}

async function send({ to, subject, html, text }: SendOpts): Promise<void> {
    const tx = getTransporter();
    if (!tx) {
        // eslint-disable-next-line no-console
        console.log(`\n[email:dev] → ${to}\n  subject: ${subject}\n  ${text}\n`);
        return;
    }
    await tx.sendMail({ from: env.MAIL_FROM, to, subject, html, text });
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shell(inner: string): string {
    return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">${inner}</div>`;
}

/**
 * Lastward check-in warning to the SWITCH OWNER. Sent by the sweep during the grace
 * window: the deadline has passed and the switch will fire at `firesAt` unless the
 * owner proves they are still around.
 */
export async function sendWarningEmail(
    to: string,
    opts: { title: string; firesAt: Date; checkinUrl: string },
): Promise<void> {
    const when = opts.firesAt.toUTCString();
    await send({
        to,
        subject: `Check in to keep "${opts.title}" from firing`,
        text: `Your Lastward switch "${opts.title}" is waiting for a check-in.\nIf you don't check in, it will fire on ${when}.\nCheck in from your Lastward client (instance: ${opts.checkinUrl}).`,
        html: shell(
            `<p style="color:#b45309;font-size:13px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px">Check-in needed</p>` +
            `<h2 style="margin:0 0 8px">${escapeHtml(opts.title)}</h2>` +
            `<p style="color:#444;margin:0 0 12px">Your switch is waiting for a check-in. If you don't check in, it will fire on <b>${when}</b>.</p>` +
            `<p style="color:#444;margin:0 0 12px">Open your Lastward client to check in. Instance: <a href="${opts.checkinUrl}" style="color:#2563eb">${opts.checkinUrl}</a></p>` +
            `<p style="color:#888;font-size:13px">If this wasn't expected, review your switch.</p>`,
        ),
    });
}

/**
 * Lastward fire notification to a RECIPIENT. Carries any readable messages inline,
 * a link to the release page for encrypted items (where the recipient enters the
 * passphrase the owner shared out-of-band), and any public-page URLs that went
 * live. The server never sees the passphrase or the encrypted content.
 */
export async function sendFireEmail(
    to: string,
    opts: {
        switchTitle: string;
        recipientName?: string | null;
        readableMessages?: string[];
        releaseUrl?: string | null;
        publicUrls?: string[];
    },
): Promise<void> {
    const hello = opts.recipientName ? `Hello ${escapeHtml(opts.recipientName)},` : 'Hello,';
    const messages = (opts.readableMessages ?? []).filter((m) => m && m.trim());
    const messagesHtml = messages
        .map(
            (m) =>
                `<div style="border-left:3px solid #e5e7eb;padding:4px 0 4px 12px;margin:12px 0;color:#444;white-space:pre-wrap">${escapeHtml(m)}</div>`,
        )
        .join('');
    const releaseHtml = opts.releaseUrl
        ? `<p style="color:#444;margin:16px 0 4px">Some items were left for you securely. Open them here:</p>` +
        `<p style="margin:4px 0 16px"><a href="${opts.releaseUrl}" style="color:#2563eb;font-weight:600">Open what was left for you</a></p>` +
        `<p style="color:#888;font-size:13px">You'll need the passphrase the sender shared with you. We can't read the content and can't recover the passphrase.</p>`
        : '';
    const publicUrls = (opts.publicUrls ?? []).filter(Boolean);
    const publicHtml = publicUrls.length
        ? `<p style="color:#444;margin:16px 0 4px">Public pages were published:</p>` +
        publicUrls
            .map((u) => `<p style="margin:2px 0"><a href="${u}" style="color:#2563eb">${escapeHtml(u)}</a></p>`)
            .join('')
        : '';
    const textParts = [
        opts.recipientName ? `Hello ${opts.recipientName},` : 'Hello,',
        `Something was left for you through Lastward ("${opts.switchTitle}").`,
        ...messages,
        opts.releaseUrl
            ? `Open the secure items here: ${opts.releaseUrl} (you'll need the passphrase the sender shared with you).`
            : '',
        ...(publicUrls.length ? ['Public pages:', ...publicUrls] : []),
    ].filter(Boolean);
    await send({
        to,
        subject: `Something was left for you: ${opts.switchTitle}`,
        text: textParts.join('\n\n'),
        html: shell(
            `<p style="color:#444;margin:0 0 8px">${hello}</p>` +
            `<h2 style="margin:0 0 8px">Something was left for you</h2>` +
            `<p style="color:#444;margin:0 0 8px">This was set up in advance through Lastward ("${escapeHtml(
                opts.switchTitle,
            )}") and released to you now.</p>` +
            messagesHtml +
            releaseHtml +
            publicHtml,
        ),
    });
}
