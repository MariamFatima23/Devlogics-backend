const Application = require('../models/Application.model');
const Notification = require('../models/Notification.model');
const { getStatusTransitionError } = require('../utils/applicationStatus');
const path = require('path');

// Helper: Create notification
const createNotification = async (userId, applicationId, type, title, message) => {
  try {
    await Notification.create({ userId, applicationId, type, title, message });
  } catch (err) {
    console.error('Notification error:', err);
  }
};

// ─── STUDENT: Submit new application ───
const submitApplication = async (req, res) => {
  try {
    const { type, title, description, rollNumber, department, batchester } = req.body;

    // Build attachments array from uploaded files
    const attachments = (req.files || []).map((file) => ({
      originalName: file.originalname,
      fileName: file.filename,
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
    }));

    const application = await Application.create({
      type,
      title,
      description,
      rollNumber,
      department,
      batchester,
      attachments,
      studentId: req.user.id,
      studentName: req.user.name,
      studentEmail: req.user.email,
      timeline: [{ status: 'Pending', comment: 'Application submitted', updatedBy: req.user.name }],
    });

    // Create notification for student
    await createNotification(
      req.user.id,
      application._id,
      'application_submitted',
      'Application Submitted',
      `Your ${type} application has been submitted successfully and is pending review.`
    );

    // Notify admins
    const { notifyAdmins } = require('../routes/notification.routes');
    await notifyAdmins(
      'new_general_application',
      '📄 New Application Received',
      `${req.user.name} submitted a "${type}" application. Review it in the admin panel.`,
      { applicationId: application._id },
    );

    res.status(201).json({ message: 'Application submitted successfully', application });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── STUDENT: Get own applications ───
const getMyApplications = async (req, res) => {
  try {
    const applications = await Application.find({ studentId: req.user.id }).sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── STUDENT: Get single application ───
const getApplicationById = async (req, res) => {
  try {
    const app = await Application.findOne({ _id: req.params.id, studentId: req.user.id });
    if (!app) return res.status(404).json({ message: 'Application not found' });
    res.json(app);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── ADMIN: Get all applications (with optional filter) ───
const getAllApplications = async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type)   filter.type   = req.query.type;

    const applications = await Application.find(filter).sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── ADMIN: Update application status ───
const updateStatus = async (req, res) => {
  try {
    const { status, adminComment, rejectionReason } = req.body;

    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ message: 'Application not found' });

    const transitionError = getStatusTransitionError(app.status, status);
    if (transitionError) {
      return res.status(400).json({ message: transitionError });
    }

    app.status          = status;
    app.adminComment    = adminComment || '';
    app.rejectionReason = rejectionReason || '';
    app.reviewedBy      = req.user.name;
    app.reviewedAt      = new Date();

    // Add to timeline
    app.timeline.push({
      status,
      comment: adminComment || rejectionReason || `Status changed to ${status}`,
      updatedBy: req.user.name,
    });

    await app.save();

    // Create notification for student
    let notifType = 'status_updated';
    let notifTitle = 'Application Status Updated';
    let notifMessage = `Your ${app.type} application status has been changed to ${status}.`;

    if (status === 'Under Review') {
      notifType = 'under_review';
      notifTitle = 'Application Under Review';
      notifMessage = `Your ${app.type} application is now under review by the admin.`;
    } else if (status === 'Approved') {
      notifType = 'approved';
      notifTitle = '✅ Application Approved';
      notifMessage = `Great news! Your ${app.type} application has been approved.${adminComment ? ` Admin note: ${adminComment}` : ''}`;
    } else if (status === 'Rejected') {
      notifType = 'rejected';
      notifTitle = '❌ Application Rejected';
      notifMessage = `Your ${app.type} application has been rejected.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`;
    }

    await createNotification(app.studentId, app._id, notifType, notifTitle, notifMessage);

    res.json({ message: `Application ${status.toLowerCase()} successfully`, application: app });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ─── STATS ───
const getStats = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const filter  = isAdmin ? {} : { studentId: req.user.id };

    const [total, pending, underReview, approved, rejected] = await Promise.all([
      Application.countDocuments(filter),
      Application.countDocuments({ ...filter, status: 'Pending' }),
      Application.countDocuments({ ...filter, status: 'Under Review' }),
      Application.countDocuments({ ...filter, status: 'Approved' }),
      Application.countDocuments({ ...filter, status: 'Rejected' }),
    ]);

    // Type breakdown for admin
    let byType = [];
    if (isAdmin) {
      const types = ['Fee Concession','Scholarship','Character Certificate','Hostel Allocation','Transcript Request','Complaint'];
      byType = await Promise.all(
        types.map(async (t) => ({ type: t, count: await Application.countDocuments({ type: t }) }))
      );
    }

    res.json({ total, pending, underReview, approved, rejected, byType });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  submitApplication,
  getMyApplications,
  getApplicationById,
  getAllApplications,
  updateStatus,
  getStats,
};
