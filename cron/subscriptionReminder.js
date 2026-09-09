/**
 * subscriptionReminder.js
 * ─────────────────────────────────────────────────────────────────
 * Daily cron job — runs every day at 8:00 AM Pakistan time (UTC+5)
 * which is 03:00 AM UTC.
 *
 * Logic:
 *   For each active subscription, calculate daysLeft until nextBillingDate.
 *   Send email ONLY to the lead — NO admin notification at all.
 *
 * Reminder schedule:
 *   daysLeft === 7  → "7 din mein due"
 *   daysLeft === 3  → "3 din mein due"
 *   daysLeft === 1  → "kal due hai"
 *   daysLeft === 0  → "aaj due hai"
 *   daysLeft < 0    → "overdue"  (repeat every day until paid)
 *
 * To prevent spam, each subscription gets ONE email per trigger day.
 * We track lastReminderSentAt on Subscription. If already sent today
 * for the same daysLeft trigger, skip it.
 */

const cron         = require('node-cron');
const mongoose     = require('mongoose');
const Subscription = require('../models/Subscription.model');
const Lead         = require('../models/Lead.model');
const { sendEmail } = require('../utils/email');

// ── Trigger days (positive = days before due, 0 = due today, negative = overdue) ──
const TRIGGER_DAYS = [7, 3, 1, 0];  // plus any daysLeft < 0

const PLAN_LABELS = {
  'plan-a-monthly': 'Plan A (Monthly)',
  'plan-b-daily':   'Plan B (Daily)',
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ── Email HTML builder ────────────────────────────────────────────
function buildReminderEmail({ clientName, planLabel, amount, dueDate, daysLeft, portalUrl }) {
  const isOverdue = daysLeft < 0;
  const isToday   = daysLeft === 0;
  const isTomorrow = daysLeft === 1;

  const headerGrad = isOverdue
    ? '#dc2626,#b91c1c'
    : isToday || isTomorrow
    ? '#d97706,#b45309'
    : '#04065c,#0077b6';

  const emoji = isOverdue ? '🔴' : isToday ? '⚠️' : '🔔';

  const subject = isOverdue
    ? `🔴 Subscription Overdue — Foran Renew Karein | DevLogics`
    : isToday
    ? `⚠️ Subscription Payment Aaj Due Hai | DevLogics`
    : isTomorrow
    ? `🔔 Kal Subscription Due Hai — Tayar Rahein | DevLogics`
    : `🔔 Subscription Payment ${daysLeft} Din Mein Due | DevLogics`;

  const bodyText = isOverdue
    ? `Aapki subscription payment <strong>${Math.abs(daysLeft)} din pehle</strong> due thi aur abhi tak nahi hui. Foran apne portal pe login kar ke renewal request karein.`
    : isToday
    ? `Aapki subscription payment <strong>aaj</strong> due hai. Abhi portal pe login karein aur renewal request submit karein.`
    : isTomorrow
    ? `Aapki subscription payment <strong>kal</strong> due hogi. Waqt par payment karein taake service mein koi interruption na aaye.`
    : `Aapki subscription payment <strong>${daysLeft} din</strong> mein due hogi (${dueDate}). Timely renewal ke liye abhi se tayar rahein.`;

  const boxBg     = isOverdue ? '#fff1f2' : isToday || isTomorrow ? '#fff7ed' : '#fffbeb';
  const boxBorder = isOverdue ? '#fecaca' : isToday || isTomorrow ? '#fed7aa' : '#fde68a';
  const dateColor = isOverdue ? '#dc2626' : isToday ? '#ea580c' : '#d97706';

  const statusLabel = isOverdue
    ? `🔴 ${Math.abs(daysLeft)} din se overdue`
    : isToday
    ? '⚠️ Aaj due hai'
    : isTomorrow
    ? '⏰ Kal due hai'
    : `⏰ ${daysLeft} din mein due`;

  return {
    subject,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:40px 16px;">
    <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,${headerGrad});border-radius:16px 16px 0 0;padding:32px;text-align:center;">
        <h1 style="margin:0 0 6px;color:#fff;font-size:22px;font-weight:800;">${emoji} Subscription Reminder</h1>
        <p style="margin:0;color:rgba(255,255,255,0.75);font-size:13px;">DevLogics — Automated Payment Reminder</p>
      </td></tr>

      <!-- Body -->
      <tr><td style="background:#ffffff;padding:32px;border-radius:0 0 16px 16px;">
        <p style="color:#1f2937;font-size:15px;margin:0 0 14px;">
          Assalam o Alaikum <strong>${clientName}</strong>,
        </p>
        <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 22px;">
          ${bodyText}
        </p>

        <!-- Details box -->
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:${boxBg};border:1px solid ${boxBorder};border-radius:12px;margin-bottom:22px;">
          <tr><td style="padding:16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:5px 0;color:#6b7280;font-size:13px;">Plan</td>
                <td style="padding:5px 0;color:#1f2937;font-size:13px;font-weight:700;text-align:right;">${planLabel}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;color:#6b7280;font-size:13px;">Amount</td>
                <td style="padding:5px 0;color:#1f2937;font-size:13px;font-weight:700;text-align:right;">PKR ${Number(amount).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;color:#6b7280;font-size:13px;">Due Date</td>
                <td style="padding:5px 0;font-size:13px;font-weight:800;text-align:right;color:${dateColor};">${dueDate}</td>
              </tr>
              <tr>
                <td style="padding:5px 0;color:#6b7280;font-size:13px;">Status</td>
                <td style="padding:5px 0;font-size:13px;font-weight:800;text-align:right;color:${dateColor};">${statusLabel}</td>
              </tr>
            </table>
          </td></tr>
        </table>

        <!-- CTA Button -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="padding:4px 0 24px;">
            <a href="${portalUrl}/student-portal"
              style="display:inline-block;background:linear-gradient(135deg,#04065c,#0077b6);color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:12px;">
              🔗 Portal Pe Login Karein
            </a>
          </td></tr>
        </table>

        <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 18px;"/>
        <p style="color:#9ca3af;font-size:11px;text-align:center;margin:0;line-height:1.6;">
          Yeh ek automated reminder email hai.<br/>
          Kisi bhi query ke liye humse rabta karein.<br/>
          © ${new Date().getFullYear()} DevLogics. All rights reserved.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`,
    text: `${statusLabel} — ${planLabel} — PKR ${amount} — Due: ${dueDate}`,
  };
}

// ── Main reminder function (also exported for manual trigger) ─────
async function runSubscriptionReminders() {
  console.log(`\n🕐 [Cron] subscriptionReminder running — ${new Date().toISOString()}`);

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // All active subscriptions
    const subs = await Subscription.find({ status: 'active' })
      .populate('leadId', 'clientName email contact');

    let sent    = 0;
    let skipped = 0;
    let failed  = 0;

    const portalUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    for (const sub of subs) {
      const lead = sub.leadId;
      if (!lead?.email) { skipped++; continue; }

      // Calculate daysLeft
      const due      = new Date(sub.nextBillingDate);
      due.setHours(0, 0, 0, 0);
      const msLeft   = due.getTime() - today.getTime();
      const daysLeft = Math.round(msLeft / (1000 * 60 * 60 * 24));

      // Decide if this is a trigger day
      const isTrigger = TRIGGER_DAYS.includes(daysLeft) || daysLeft < 0;
      if (!isTrigger) { skipped++; continue; }

      // Avoid duplicate emails: check lastReminderSentAt
      // We store it as { daysLeft, date } in the sub — skip if already sent today for same trigger
      if (sub.lastReminderSentAt) {
        const lastSentDate = new Date(sub.lastReminderSentAt);
        lastSentDate.setHours(0, 0, 0, 0);
        const lastDaysLeft = sub.lastReminderDaysLeft;
        if (
          lastSentDate.getTime() === today.getTime() &&
          lastDaysLeft === daysLeft
        ) {
          skipped++;
          continue;
        }
      }

      // Build and send email
      const planLabel = PLAN_LABELS[sub.planType] || sub.planType;
      const dueDate   = fmtDate(sub.nextBillingDate);

      const { subject, html, text } = buildReminderEmail({
        clientName: lead.clientName,
        planLabel,
        amount:     sub.amount,
        dueDate,
        daysLeft,
        portalUrl,
      });

      try {
        await sendEmail(lead.email, subject, html, text);

        // Save last reminder info to avoid duplicate
        await Subscription.findByIdAndUpdate(sub._id, {
          lastReminderSentAt:  new Date(),
          lastReminderDaysLeft: daysLeft,
        });

        sent++;
        console.log(`  ✅ Reminder sent → ${lead.email} (daysLeft: ${daysLeft})`);
      } catch (emailErr) {
        failed++;
        console.error(`  ❌ Email failed → ${lead.email}: ${emailErr.message}`);
      }
    }

    console.log(`\n📊 [Cron] Done — Sent: ${sent} | Skipped: ${skipped} | Failed: ${failed}\n`);
    return { sent, skipped, failed };
  } catch (err) {
    console.error('❌ [Cron] subscriptionReminder error:', err.message);
    return { sent: 0, skipped: 0, failed: 0, error: err.message };
  }
}

// ── Register the cron schedule ────────────────────────────────────
// '0 3 * * *' = every day at 03:00 UTC = 08:00 AM Pakistan (UTC+5)
function startSubscriptionReminderCron() {
  cron.schedule('0 3 * * *', runSubscriptionReminders, {
    scheduled: true,
    timezone:  'UTC',
  });
  console.log('⏰ [Cron] subscriptionReminder scheduled — runs daily at 08:00 AM PKT (03:00 UTC)');
}

module.exports = { startSubscriptionReminderCron, runSubscriptionReminders };
