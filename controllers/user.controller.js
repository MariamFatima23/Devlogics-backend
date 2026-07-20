const User = require('../models/User.model');
const jwt = require('jsonwebtoken');
const Course = require('../models/Course.model');
const CourseApplication = require('../models/CourseApplication.model');
const Application = require('../models/Application.model');
const Review = require('../models/Review.model');

// Helper: Generate fresh token
const generateToken = (user) =>
  jwt.sign(
    {
      id: user._id, role: user.role, name: user.name, email: user.email,
      rollNumber: user.rollNumber, department: user.department,
      batchester: user.batchester, phone: user.phone,
      profileImage: user.profileImage, cnic: user.cnic,
      gender: user.gender, dob: user.dob,
      country: user.country, city: user.city,
      qualification: user.qualification, cv: user.cv,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

// Get all users (admin)
const getAllUsers = async (req, res) => {
  try {
    const filter = {};
    if (req.query.role)   filter.role   = req.query.role;
    if (req.query.search) {
      filter.$or = [
        { name:  { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Block / Unblock user (admin)
const blockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Cannot block an admin' });
    user.isBlocked = !user.isBlocked;
    await user.save();
    res.json({ message: `User ${user.isBlocked ? 'blocked' : 'unblocked'}`, isBlocked: user.isBlocked });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin dashboard stats
const adminStats = async (req, res) => {
  try {
    const [
      totalStudents,
      totalCourses,
      activeCourses,
      totalReviews,
      pendingCourseApps,
      approvedCourseApps,
      rejectedCourseApps,
      pendingApps,
      approvedApps,
    ] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Course.countDocuments(),
      Course.countDocuments({ isActive: true }),
      Review.countDocuments(),
      CourseApplication.countDocuments({ status: 'Pending' }),
      CourseApplication.countDocuments({ status: 'Approved' }),
      CourseApplication.countDocuments({ status: 'Rejected' }),
      Application.countDocuments({ status: 'Pending' }),
      Application.countDocuments({ status: 'Approved' }),
    ]);

    // Recent course applications (last 5)
    const recentActivity = await CourseApplication.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('studentName courseName status createdAt');

    res.json({
      totalStudents,
      totalCourses,
      activeCourses,
      totalReviews,
      pendingCourseApps,
      approvedCourseApps,
      rejectedCourseApps,
      pendingApps,
      approvedApps,
      recentActivity,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update profile — also returns a fresh token so navbar updates immediately
const updateProfile = async (req, res) => {
  try {
    const { name, phone, rollNumber, department, batchester, cnic, gender, dob, country, city, qualification } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const updateData = {
      name:          name.trim(),
      phone:         phone         || '',
      rollNumber:    rollNumber    || '',
      department:    department    || '',
      batchester:    batchester    || '',
      cnic:          cnic          || '',
      gender:        gender        || '',
      dob:           dob           || '',
      country:       country       || '',
      city:          city          || '',
      qualification: qualification || '',
    };

    // Profile image
    if (req.files?.profileImage?.[0]) {
      updateData.profileImage = req.files.profileImage[0].filename;
    } else if (req.file) {
      updateData.profileImage = req.file.filename;
    }

    // CV upload
    if (req.files?.cv?.[0]) {
      updateData.cv = req.files.cv[0].filename;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });

    const newToken = generateToken(user);

    res.json({
      message: 'Profile updated successfully',
      token: newToken,
      user: {
        id:            user._id,
        name:          user.name,
        email:         user.email,
        role:          user.role,
        rollNumber:    user.rollNumber,
        department:    user.department,
        batchester:    user.batchester,
        phone:         user.phone,
        profileImage:  user.profileImage,
        cnic:          user.cnic,
        gender:        user.gender,
        dob:           user.dob,
        country:       user.country,
        city:          user.city,
        qualification: user.qualification,
        cv:            user.cv,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getAllUsers, getUserById, updateProfile, blockUser, adminStats };
