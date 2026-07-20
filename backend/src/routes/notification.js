'use strict';
const express      = require('express');
const router       = express.Router();
const { protect }  = require('../middleware/auth');
const Notification = require('../models/Notification');

// ── GET /api/notifications ────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit) || 30, 100);
    const skip   = Number(req.query.skip) || 0;
    const unread = req.query.unread === 'true';

    const filter = { recipient: req.user._id };
    if (unread) filter.isRead = false;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    res.json({ success: true, notifications, unreadCount, total: notifications.length });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── PUT /api/notifications/read-all ──────────────────────────────────────────
// Must be before /:id to avoid conflict
router.put('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── PUT /api/notifications/:id/read ──────────────────────────────────────────
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    );
    if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, notification: notif });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── DELETE /api/notifications/:id ────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    await Notification.deleteOne({ _id: req.params.id, recipient: req.user._id });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── DELETE /api/notifications — clear all read ────────────────────────────────
router.delete('/', protect, async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id, isRead: true });
    res.json({ success: true, message: 'Read notifications cleared' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;