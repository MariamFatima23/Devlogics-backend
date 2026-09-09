const Client        = require('../models/Client.model');
const ClientBilling = require('../models/ClientBilling.model');
const { notifyAdmins } = require('../routes/notification.routes');
const { sendEmail }    = require('../utils/email');

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ── CLIENT CRUD ───────────────────────────────────────────────────

/* GET /api/clients */
const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find()
      .sort({ createdAt: -1 })
      .populate('addedBy', 'name email');
    res.json({ success: true, count: clients.length, data: clients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* POST /api/clients */
const addClient = async (req, res) => {
  try {
    const { name, email, phone, company, address, notes } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Client name is required' });

    const client = await Client.create({
      name: name.trim(), email, phone, company, address, notes,
      addedBy: req.user.id,
    });
    res.status(201).json({ success: true, data: client });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* PUT /api/clients/:id */
const updateClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    res.json({ success: true, data: client });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* DELETE /api/clients/:id */
const deleteClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });
    // Also remove all billings for this client
    await ClientBilling.deleteMany({ clientId: req.params.id });
    res.json({ success: true, message: 'Client and all billings deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── BILLING CRUD ──────────────────────────────────────────────────

/* GET /api/clients/:clientId/billings */
const getClientBillings = async (req, res) => {
  try {
    const billings = await ClientBilling.find({ clientId: req.params.clientId })
      .sort({ startDate: -1 })
      .populate('addedBy', 'name email');
    res.json({ success: true, count: billings.length, data: billings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/* POST /api/clients/:clientId/billings */
const addBilling = async (req, res) => {
  try {
    const { tenure, amount, startDate, description } = req.body;
    if (!tenure)    return res.status(400).json({ success: false, message: 'Tenure is required' });
    if (!amount)    return res.status(400).json({ success: false, message: 'Amount is required' });
    if (!startDate) return res.status(400).json({ success: false, message: 'Start date is required' });

    const billing = await ClientBilling.create({
      clientId:    req.params.clientId,
      tenure,
      amount:      Number(amount),
      startDate:   new Date(startDate),
      description: description || '',
      status:      'Active',
      addedBy:     req.user.id,
    });
    res.status(201).json({ success: true, data: billing });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* PUT /api/clients/billings/:billingId */
const updateBilling = async (req, res) => {
  try {
    const billing = await ClientBilling.findByIdAndUpdate(
      req.params.billingId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!billing) return res.status(404).json({ success: false, message: 'Billing not found' });
    res.json({ success: true, data: billing });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/* DELETE /api/clients/billings/:billingId */
const deleteBilling = async (req, res) => {
  try {
    const billing = await ClientBilling.findByIdAndDelete(req.params.billingId);
    if (!billing) return res.status(404).json({ success: false, message: 'Billing not found' });
    res.json({ success: true, message: 'Billing deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── EXPIRY CHECK ──────────────────────────────────────────────────
/**
 * GET /api/clients/expiry-alerts
 * Returns billings expiring within 30 days (with urgency level).
 * - daysLeft <= 7  → 'urgent'
 * - daysLeft <= 30 → 'warning'
 * Already expired (daysLeft < 0) are also included as 'expired'.
 */
const getExpiryAlerts = async (req, res) => {
  try {
    const now      = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Fetch Active billings whose endDate is within next 30 days (or already past)
    const billings = await ClientBilling.find({
      status:  'Active',
      endDate: { $lte: in30Days },
    })
      .populate('clientId', 'name email phone company')
      .populate('addedBy', 'name')
      .sort({ endDate: 1 });

    const alerts = billings.map((b) => {
      const msLeft   = new Date(b.endDate).getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      let level = 'warning';
      if (daysLeft < 0)  level = 'expired';
      else if (daysLeft <= 7) level = 'urgent';

      return {
        _id:         b._id,
        client:      b.clientId,
        tenure:      b.tenure,
        amount:      b.amount,
        startDate:   b.startDate,
        endDate:     b.endDate,
        description: b.description,
        daysLeft,
        level,          // 'expired' | 'urgent' | 'warning'
      };
    });

    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── SEND EXPIRY ALERTS ────────────────────────────────────────────
/**
 * POST /api/clients/send-expiry-alerts
 * Finds all Active billings expiring within 30 days (or already expired).
 * For each:
 *   1. Sends an email to the client (if email exists).
 *   2. Creates an in-app notification for all admins.
 * Returns a summary of emails sent / failed.
 */
const sendExpiryAlerts = async (req, res) => {
  try {
    const now      = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Active billings expiring within 30 days OR already expired
    const billings = await ClientBilling.find({
      status:  'Active',
      endDate: { $lte: in30Days },
    })
      .populate('clientId', 'name email phone company')
      .sort({ endDate: 1 });

    if (billings.length === 0) {
      return res.json({ success: true, sent: 0, message: 'Koi expiring billing nahi mili' });
    }

    let emailsSent  = 0;
    let emailFailed = 0;

    for (const billing of billings) {
      const client   = billing.clientId;
      const msLeft   = new Date(billing.endDate).getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
      const expired  = daysLeft < 0;
      const urgent   = !expired && daysLeft <= 7;

      const endDateStr = fmtDate(billing.endDate);

      // ── Urgency label ─────────────────────────────────────────
      const urgencyLabel = expired
        ? `Expired ${Math.abs(daysLeft)} days ago`
        : urgent
        ? `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (URGENT)`
        : `Expires in ${daysLeft} days`;

      const headerColor  = expired || urgent ? '#dc2626,#b91c1c' : '#d97706,#b45309';
      const headerEmoji  = expired ? '🔴' : urgent ? '⚠️' : '⏰';
      const subjectLine  = expired
        ? `🔴 Billing Expired — ${client?.name || 'Client'}`
        : urgent
        ? `⚠️ Billing Expiring Soon — ${client?.name || 'Client'}`
        : `⏰ Billing Renewal Reminder — ${client?.name || 'Client'}`;

      // ── Email to client ───────────────────────────────────────
      if (client?.email) {
        try {
          const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,${headerColor});border-radius:16px 16px 0 0;padding:32px;text-align:center;">
          <h1 style="margin:0 0 6px;color:#fff;font-size:22px;font-weight:800;">
            ${headerEmoji} ${expired ? 'Billing Expired' : urgent ? 'Urgent: Expiring Soon' : 'Renewal Reminder'}
          </h1>
          <p style="margin:0;color:rgba(255,255,255,0.75);font-size:13px;">DevLogics — Client Billing Alert</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px;border-radius:0 0 16px 16px;">
          <p style="color:#1f2937;font-size:15px;margin:0 0 12px;">
            Assalam o Alaikum <strong>${client.name}</strong>,
          </p>
          <p style="color:#6b7280;font-size:14px;line-height:1.7;margin:0 0 20px;">
            ${expired
              ? `Aapki service billing <strong>expire ho chuki hai</strong>. Meherbani karke service continue rakhne ke liye jald renewal karein.`
              : urgent
              ? `Aapki service billing <strong>${daysLeft} din</strong> mein expire hone wali hai. Jald renewal karein taake service mein koi interruption na ho.`
              : `Aapki service billing <strong>${daysLeft} din</strong> mein expire hogi. Timely renewal ke liye abhi rabta karein.`
            }
          </p>

          <!-- Details box -->
          <table width="100%" cellpadding="0" cellspacing="0"
            style="background:${expired ? '#fff1f2' : urgent ? '#fff7ed' : '#fffbeb'};border-radius:12px;border:1px solid ${expired ? '#fecaca' : urgent ? '#fed7aa' : '#fde68a'};margin-bottom:24px;">
            <tr><td style="padding:16px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${client.company ? `<tr>
                  <td style="padding:5px 0;color:#6b7280;font-size:13px;">Company</td>
                  <td style="padding:5px 0;color:#1f2937;font-size:13px;font-weight:700;text-align:right;">${client.company}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:5px 0;color:#6b7280;font-size:13px;">Tenure</td>
                  <td style="padding:5px 0;color:#1f2937;font-size:13px;font-weight:700;text-align:right;">${billing.tenure}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;color:#6b7280;font-size:13px;">Amount</td>
                  <td style="padding:5px 0;color:#1f2937;font-size:13px;font-weight:700;text-align:right;">PKR ${billing.amount.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding:5px 0;color:#6b7280;font-size:13px;">${expired ? 'Expired On' : 'Expires On'}</td>
                  <td style="padding:5px 0;font-size:13px;font-weight:800;text-align:right;color:${expired ? '#dc2626' : urgent ? '#ea580c' : '#d97706'};">
                    ${endDateStr}
                  </td>
                </tr>
                <tr>
                  <td style="padding:5px 0;color:#6b7280;font-size:13px;">Status</td>
                  <td style="padding:5px 0;font-size:13px;font-weight:800;text-align:right;color:${expired ? '#dc2626' : '#d97706'};">
                    ${urgencyLabel}
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>

          ${billing.description ? `<p style="color:#9ca3af;font-size:12px;margin:0 0 20px;">📝 ${billing.description}</p>` : ''}

          <hr style="border:none;border-top:1px solid #f3f4f6;margin:0 0 20px;"/>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
            Renewal ke liye humse rabta karein.<br/>
            © ${new Date().getFullYear()} DevLogics. All rights reserved.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

          await sendEmail(
            client.email,
            subjectLine,
            html,
            `${urgencyLabel} — Tenure: ${billing.tenure} — PKR ${billing.amount} — End Date: ${endDateStr}`
          );
          emailsSent++;
        } catch (emailErr) {
          console.error(`Email failed for ${client.email}:`, emailErr.message);
          emailFailed++;
        }
      }

      // ── Admin in-app notification ─────────────────────────────
      try {
        const notifType  = expired ? 'subscription_overdue' : 'subscription_due';
        const notifTitle = expired
          ? `🔴 Expired: ${client?.name || 'Client'}`
          : urgent
          ? `⚠️ Urgent: ${client?.name || 'Client'}`
          : `⏰ Expiring: ${client?.name || 'Client'}`;
        const notifMsg = `${billing.tenure} billing — PKR ${billing.amount.toLocaleString()} — ${urgencyLabel}`;
        await notifyAdmins(notifType, notifTitle, notifMsg);
      } catch {}
    }

    res.json({
      success:     true,
      total:       billings.length,
      emailsSent,
      emailFailed,
      noEmail:     billings.length - emailsSent - emailFailed,
      message:     `${billings.length} expiring billings found. ${emailsSent} email alerts sent to clients.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getAllClients,
  addClient,
  updateClient,
  deleteClient,
  getClientBillings,
  addBilling,
  updateBilling,
  deleteBilling,
  getExpiryAlerts,
  sendExpiryAlerts,
};
