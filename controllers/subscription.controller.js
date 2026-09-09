const Subscription  = require('../models/Subscription.model');
const BillingRecord = require('../models/BillingRecord.model');
const User          = require('../models/User.model');
const bcrypt        = require('bcryptjs');
const { calcNextBillingDate } = require('../models/Subscription.model');
const { notifyAdmins } = require('../routes/notification.routes');
const { sendEmail }    = require('../utils/email');

const PLAN_LABELS = {
  'plan-a-monthly': 'Plan A (Monthly)',
  'plan-b-daily':   'Plan B (Daily)',
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ── Expiry warning ────────────────────────────────────────────────
function getExpiryWarning(nextBillingDate) {
  const now  = new Date(); now.setHours(0,0,0,0);
  const due  = new Date(nextBillingDate); due.setHours(0,0,0,0);
  const daysLeft = Math.ceil((due - now) / (1000*60*60*24));
  if (daysLeft < 0)   return { level:'overdue',  daysLeft, label:`Payment overdue by ${Math.abs(daysLeft)} day(s)` };
  if (daysLeft === 0) return { level:'today',    daysLeft, label:'Payment is due today' };
  if (daysLeft <= 7)  return { level:'upcoming', daysLeft, label:`Payment due in ${daysLeft} day(s)` };
  return { level:'ok', daysLeft, label:`Next payment on ${fmtDate(nextBillingDate)}` };
}

// ── Welcome email — ONLY email + password, no portal link ─────────
function buildWelcomeEmail({ name, email, tempPassword, label, amount, startStr, nextDueStr }) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
  <tr><td align="center" style="padding:40px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

      <!-- HEADER -->
      <tr><td style="background:linear-gradient(135deg,#04065c 0%,#0077b6 100%);border-radius:16px 16px 0 0;padding:36px 32px;text-align:center;">
        <div style="font-size:44px;margin-bottom:10px;">🎉</div>
        <h1 style="margin:0 0 8px;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.3px;">
          Your Subscription is Active!
        </h1>
        <p style="margin:0;color:rgba(255,255,255,0.72);font-size:14px;">
          DevLogics — Subscription Confirmation
        </p>
      </td></tr>

      <!-- BODY -->
      <tr><td style="background:#ffffff;padding:36px 32px;border-radius:0 0 16px 16px;border:1px solid #e2e8f0;border-top:none;">

        <p style="margin:0 0 8px;color:#1e293b;font-size:16px;font-weight:700;">Dear ${name},</p>
        <p style="margin:0 0 28px;color:#64748b;font-size:14px;line-height:1.7;">
          Your DevLogics subscription has been successfully activated.
          Please find your login credentials and subscription details below.
        </p>

        <!-- LOGIN CREDENTIALS -->
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#f0fdf4;border:2px solid #86efac;border-radius:14px;margin-bottom:24px;">
          <tr><td style="padding:22px 24px;">
            <p style="margin:0 0 18px;color:#15803d;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">
              🔑 &nbsp; Your Login Credentials
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #dcfce7;color:#64748b;font-size:13px;width:38%;">Login Email</td>
                <td style="padding:10px 0;border-bottom:1px solid #dcfce7;text-align:right;color:#1e293b;font-size:14px;font-weight:700;">
                  ${email}
                </td>
              </tr>
              <tr>
                <td style="padding:14px 0 6px;color:#64748b;font-size:13px;vertical-align:middle;">Password</td>
                <td style="padding:14px 0 6px;text-align:right;vertical-align:middle;">
                  <span style="display:inline-block;background:#04065c;color:#ffffff;font-size:22px;font-weight:900;letter-spacing:5px;padding:10px 22px;border-radius:10px;font-family:monospace;">
                    ${tempPassword}
                  </span>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0;color:#dc2626;font-size:12px;font-weight:600;background:#fff1f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;line-height:1.5;">
              ⚠️ <strong>Important:</strong> Please change this temporary password after your first login for your account security.
            </p>
          </td></tr>
        </table>

        <!-- SUBSCRIPTION DETAILS -->
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:14px;margin-bottom:28px;">
          <tr><td style="padding:22px 24px;">
            <p style="margin:0 0 16px;color:#4f46e5;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">
              📋 &nbsp; Subscription Details
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;width:45%;">Plan</td>
                <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;color:#1e293b;font-size:13px;font-weight:700;">${label}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;">Amount</td>
                <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;color:#1e293b;font-size:13px;font-weight:700;">PKR ${Number(amount).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;">Start Date</td>
                <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;color:#1e293b;font-size:13px;font-weight:700;">${startStr}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#64748b;font-size:13px;">Next Payment Due</td>
                <td style="padding:8px 0;text-align:right;color:#dc2626;font-size:15px;font-weight:800;">${nextDueStr}</td>
              </tr>
            </table>
          </td></tr>
        </table>

        <hr style="border:none;border-top:1px solid #f1f5f9;margin:0 0 20px;"/>
        <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;line-height:1.7;">
          If you have any questions, feel free to contact us.<br/>
          &copy; ${new Date().getFullYear()} DevLogics &mdash; All rights reserved.
        </p>

      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ── ASSIGN SUBSCRIPTION ───────────────────────────────────────────
const assignSubscription = async (req, res) => {
  try {
    const { leadId, planType, amount, startDate } = req.body;

    if (!leadId)    return res.status(400).json({ message: 'Lead is required' });
    if (!planType)  return res.status(400).json({ message: 'Plan type is required' });
    if (!amount)    return res.status(400).json({ message: 'Amount is required' });
    if (!startDate) return res.status(400).json({ message: 'Start date is required' });

    const Lead = require('../models/Lead.model');
    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const subscription = await Subscription.create({
      leadId,
      planType,
      amount:    Number(amount),
      startDate: new Date(startDate + 'T00:00:00'),
      status:    'active',
      createdBy: req.user.id,
    });

    await BillingRecord.create({
      subscriptionId: subscription._id,
      amount:         Number(amount),
      dueDate:        subscription.nextBillingDate,
      status:         'pending',
    });

    const populated = await Subscription.findById(subscription._id)
      .populate('leadId', 'clientName contact email');

    // ── Auto-create OR reset student account ─────────────────────
    // Always generate a fresh temp password so it always appears in email
    const namePart    = (lead.clientName || 'lead').replace(/\s+/g,'').slice(0,4).toLowerCase();
    const contactPart = (lead.contact || '0000').slice(-4);
    const tempPassword = `${namePart}${contactPart}`;
    let portalCreated  = false;

    if (lead.email) {
      const existing = await User.findOne({ email: lead.email.toLowerCase() });
      if (!existing) {
        // New account
        await User.create({
          name:               lead.clientName,
          email:              lead.email.toLowerCase(),
          password:           await bcrypt.hash(tempPassword, 10),
          role:               'student',
          phone:              lead.contact || '',
          mustChangePassword: true,
        });
        portalCreated = true;
      } else {
        // Reset password so they can use the temp password from email
        existing.password           = await bcrypt.hash(tempPassword, 10);
        existing.mustChangePassword = true;
        await existing.save();
        portalCreated = false; // account existed but password reset
      }
    }

    // ── Send welcome email ────────────────────────────────────────
    const label      = PLAN_LABELS[planType] || planType;
    const startStr   = fmtDate(new Date(startDate));
    const nextDueStr = fmtDate(subscription.nextBillingDate);

    if (lead.email) {
      try {
        const html = buildWelcomeEmail({
          name:         lead.clientName,
          email:        lead.email,
          tempPassword,
          label,
          amount,
          startStr,
          nextDueStr,
        });

        await sendEmail(
          lead.email,
          'Your DevLogics Subscription is Now Active',
          html,
          `Subscription active! Email: ${lead.email} | Password: ${tempPassword} | Plan: ${label} | Next Due: ${nextDueStr}`
        );
        console.log(`✅ Welcome email sent → ${lead.email}`);
      } catch (emailErr) {
        console.error('Welcome email failed:', emailErr.message);
      }
    } else {
      console.warn(`⚠️ Lead "${lead.clientName}" has no email — no email sent`);
    }

    // ── Notify admins ─────────────────────────────────────────────
    try {
      await notifyAdmins(
        'subscription_assigned',
        '🔔 Subscription Assigned',
        `${lead.clientName} assigned ${label} — PKR ${amount}.${portalCreated ? ' New portal account created.' : ' Password reset.'}`
      );
    } catch {}

    res.status(201).json({
      success:       true,
      data:          populated,
      emailSent:     !!lead.email,
      portalMessage: lead.email
        ? `✅ Welcome email sent to ${lead.email} with login credentials`
        : `⚠️ Lead has no email — no account created, no email sent`,
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ── GET ALL SUBSCRIPTIONS ─────────────────────────────────────────
const getAllSubscriptions = async (req, res) => {
  try {
    const subs = await Subscription.find()
      .populate('leadId', 'clientName contact email')
      .sort({ createdAt: -1 });
    res.json({ success: true, count: subs.length, data: subs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET DUE SUBSCRIPTIONS ─────────────────────────────────────────
const getDueSubscriptions = async (req, res) => {
  try {
    const today = new Date(); today.setHours(23,59,59,999);
    const subs  = await Subscription.find({ status:'active', nextBillingDate:{ $lte: today } })
      .populate('leadId','clientName contact email')
      .sort({ nextBillingDate: 1 });
    res.json({ success: true, count: subs.length, data: subs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── MARK AS PAID ──────────────────────────────────────────────────
const markAsPaid = async (req, res) => {
  try {
    const sub = await Subscription.findById(req.params.id);
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });

    await BillingRecord.findOneAndUpdate(
      { subscriptionId: sub._id, status: 'pending' },
      { status: 'paid', paidDate: new Date() },
      { sort: { dueDate: 1 } }
    );

    sub.nextBillingDate      = calcNextBillingDate(sub.nextBillingDate, sub.planType);
    sub.renewalRequested     = false;
    sub.renewalRequestedAt   = null;
    sub.lastReminderSentAt   = null;
    sub.lastReminderDaysLeft = null;
    await sub.save();

    await BillingRecord.create({
      subscriptionId: sub._id,
      amount:         sub.amount,
      dueDate:        sub.nextBillingDate,
      status:         'pending',
    });

    res.json({ success: true, data: sub });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── UPDATE STATUS ─────────────────────────────────────────────────
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active','paused','cancelled'].includes(status))
      return res.status(400).json({ message: 'Invalid status' });
    const sub = await Subscription.findByIdAndUpdate(req.params.id, { status }, { new: true })
      .populate('leadId','clientName contact email');
    if (!sub) return res.status(404).json({ message: 'Not found' });
    res.json({ success: true, data: sub });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET BILLING HISTORY ───────────────────────────────────────────
const getBillingHistory = async (req, res) => {
  try {
    const records = await BillingRecord.find({ subscriptionId: req.params.id })
      .sort({ dueDate: -1 });
    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── SEND DUE ALERTS (manual trigger) ─────────────────────────────
const sendDueAlerts = async (req, res) => {
  try {
    const { runSubscriptionReminders } = require('../cron/subscriptionReminder');
    const result = await runSubscriptionReminders();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET MY SUBSCRIPTION (STUDENT) ────────────────────────────────
const getMySubscription = async (req, res) => {
  try {
    const Lead = require('../models/Lead.model');
    const lead = await Lead.findOne({ email: req.user.email });
    if (!lead) return res.json({ success: false, message: 'No subscription found for your account' });

    const subscription = await Subscription.findOne({ leadId: lead._id, status: { $ne:'cancelled' } })
      .sort({ createdAt: -1 })
      .populate('leadId','clientName contact email');

    if (!subscription) return res.json({ success: false, message: 'No active subscription found' });

    const warning        = getExpiryWarning(subscription.nextBillingDate);
    const billingHistory = await BillingRecord.find({ subscriptionId: subscription._id })
      .sort({ dueDate: -1 }).limit(10);

    res.json({ success: true, data: { subscription, warning, billingHistory } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── REQUEST RENEWAL (STUDENT) ─────────────────────────────────────
const requestRenewal = async (req, res) => {
  try {
    const sub = await Subscription.findById(req.params.id)
      .populate('leadId','clientName contact email');
    if (!sub) return res.status(404).json({ message: 'Subscription not found' });
    if (sub.status === 'cancelled') return res.status(400).json({ message: 'Cancelled subscription cannot be renewed' });

    sub.renewalRequested   = true;
    sub.renewalRequestedAt = new Date();
    await sub.save();

    try {
      await notifyAdmins(
        'subscription_assigned',
        `🔄 Renewal Request: ${sub.leadId?.clientName}`,
        `${sub.leadId?.clientName} requested renewal for ${PLAN_LABELS[sub.planType] || sub.planType} — PKR ${sub.amount.toLocaleString()} — Due: ${fmtDate(sub.nextBillingDate)}`
      );
    } catch {}

    res.json({ success: true, message: 'Renewal request submitted. Admin will confirm and extend your subscription.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  assignSubscription,
  getAllSubscriptions,
  getDueSubscriptions,
  markAsPaid,
  updateStatus,
  getBillingHistory,
  sendDueAlerts,
  getMySubscription,
  requestRenewal,
};
