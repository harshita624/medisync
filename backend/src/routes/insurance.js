const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Claim = require('../models/Claim');
const Policy = require('../models/Policy');
const Patient = require('../models/Patient');
const Notification = require('../models/Notification');
const audit = require('../utils/audit');

router.use(protect);
router.use(authorize('insurance'));

router.get('/claims', async (req, res) => {
  try {
    const query = { insuranceCompany: req.user._id };
    if (req.query.status) query.status = req.query.status;
    const claims = await Claim.find(query)
      .populate('policy')
      .populate({ path: 'patient', populate: { path: 'user', select: 'name email phone' } })
      .sort({ submittedAt: -1, createdAt: -1 });
    res.json({ success: true, claims });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/claim/:id/process', async (req, res) => {
  try {
    const claim = await Claim.findOne({ _id: req.params.id, insuranceCompany: req.user._id }).populate('patient');
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const status = req.body.status || claim.status;
    const approvedAmount = Number(req.body.approvedAmount ?? claim.approvedAmount ?? 0);
    if (!['under_review', 'approved', 'partially_approved', 'rejected', 'paid', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid claim status' });
    }

    claim.status = status;
    claim.approvedAmount = approvedAmount;
    claim.remarks = req.body.remarks || claim.remarks;
    claim.rejectionReason = req.body.rejectionReason || claim.rejectionReason;
    claim.processedBy = req.user._id;
    claim.processedAt = new Date();
    if (status === 'paid') {
      claim.paidAmount = Number(req.body.paidAmount ?? approvedAmount);
      claim.paidAt = new Date();
    }
    claim.timeline.push({ status, message: req.body.remarks || `Claim marked ${status}`, updatedBy: req.user._id });
    await claim.save();

    if (['approved', 'partially_approved', 'paid'].includes(status) && approvedAmount > 0) {
      const policy = await Policy.findById(claim.policy);
      if (policy) {
        const approvedClaims = await Claim.aggregate([
          { $match: { policy: policy._id, status: { $in: ['approved', 'partially_approved', 'paid'] } } },
          { $group: { _id: '$policy', total: { $sum: '$approvedAmount' } } },
        ]);
        const total = approvedClaims[0]?.total || 0;
        policy.totalClaimsAmount = total;
        policy.remainingCoverage = Math.max(0, policy.coverageAmount - total);
        await policy.save();
      }
    }
    await Notification.create({
      recipient: claim.patient?.user,
      type: status === 'rejected' ? 'claim_rejected' : status === 'approved' || status === 'paid' ? 'claim_approved' : 'claim_update',
      title: `Claim ${status.replace('_', ' ')}`,
      message: `Your claim ${claim.claimNumber} was marked ${status.replace('_', ' ')}.`,
      link: '/patient/insurance',
      data: { claim: claim._id },
    }).catch(() => {});
    await audit(req, {
      action: 'insurance_claim_process',
      targetType: 'Claim',
      targetId: claim._id,
      patient: claim.patient,
      metadata: { status, approvedAmount },
    });

    res.json({ success: true, claim });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/policy', async (req, res) => {
  try {
    const patient = await Patient.findOne({ patientId: req.body.patientId });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient ID not found' });
    const policy = await Policy.create({
      patient: patient._id,
      insuranceCompany: req.user._id,
      issuedBy: req.user._id,
      policyNumber: req.body.policyNumber,
      policyName: req.body.policyName,
      policyType: req.body.policyType || 'health',
      coverageAmount: Number(req.body.coverageAmount),
      premiumAmount: Number(req.body.premiumAmount || 0),
      premiumFrequency: req.body.premiumFrequency || 'yearly',
      startDate: req.body.startDate || new Date(),
      endDate: req.body.endDate,
      status: req.body.status || 'active',
      coveredConditions: req.body.coveredConditions || [],
      exclusions: req.body.exclusions || [],
      remainingCoverage: Number(req.body.coverageAmount),
      documents: req.body.documents || [],
    });
    await Notification.create({
      recipient: patient.user,
      type: 'policy_activated',
      title: 'Insurance policy linked',
      message: `${policy.policyName || policy.policyNumber} is now linked to your HealthBridge account.`,
      link: '/patient/insurance',
      data: { policy: policy._id },
    }).catch(() => {});
    await audit(req, {
      action: 'insurance_policy_create',
      targetType: 'Policy',
      targetId: policy._id,
      patient: patient._id,
      metadata: { policyNumber: policy.policyNumber },
    });
    res.status(201).json({ success: true, policy });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const [claims, policies] = await Promise.all([
      Claim.find({ insuranceCompany: req.user._id }),
      Policy.find({ insuranceCompany: req.user._id }),
    ]);
    const stats = {
      policies: policies.length,
      activePolicies: policies.filter(p => p.status === 'active').length,
      claims: claims.length,
      pendingClaims: claims.filter(c => ['submitted', 'under_review'].includes(c.status)).length,
      approvedAmount: claims.reduce((sum, c) => sum + (c.approvedAmount || 0), 0),
      claimedAmount: claims.reduce((sum, c) => sum + (c.claimAmount || 0), 0),
    };
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
