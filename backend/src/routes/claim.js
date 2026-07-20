const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const Patient = require('../models/Patient');
const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const Notification = require('../models/Notification');
const audit = require('../utils/audit');

router.use(protect);

router.post('/', authorize('patient'), async (req, res) => {
  try {
    const patient = await Patient.findOne({ user: req.user._id });
    if (!patient) return res.status(404).json({ success: false, message: 'Patient profile not found' });

    const policy = await Policy.findOne({ _id: req.body.policy, patient: patient._id });
    if (!policy) return res.status(404).json({ success: false, message: 'Policy not found for this patient' });
    if (policy.status !== 'active') return res.status(400).json({ success: false, message: 'Only active policies can be used for claims' });

    const claimAmount = Number(req.body.claimAmount);
    if (!claimAmount || claimAmount <= 0) return res.status(400).json({ success: false, message: 'Valid claim amount is required' });

    const claim = await Claim.create({
      patient: patient._id,
      policy: policy._id,
      insuranceCompany: policy.insuranceCompany,
      medicalRecord: req.body.medicalRecord || undefined,
      doctor: req.body.doctor || undefined,
      claimType: req.body.claimType || 'other',
      claimAmount,
      description: req.body.description || '',
      status: 'submitted',
      submittedAt: new Date(),
      priority: claimAmount > (policy.coverageAmount * 0.5) ? 'high' : 'medium',
      documents: req.body.documents || [],
      timeline: [{ status: 'submitted', message: 'Claim submitted by patient', updatedBy: req.user._id }],
    });
    await Notification.insertMany([
      {
        recipient: req.user._id,
        type: 'claim_submitted',
        title: 'Claim submitted',
        message: `Claim ${claim.claimNumber} was submitted for review.`,
        link: '/patient/insurance',
        data: { claim: claim._id },
      },
      {
        recipient: policy.insuranceCompany,
        type: 'claim_submitted',
        title: 'New claim submitted',
        message: `Claim ${claim.claimNumber} needs review.`,
        link: '/insurance/claims',
        data: { claim: claim._id },
      },
    ]);
    await audit(req, {
      action: 'claim_submit',
      targetType: 'Claim',
      targetId: claim._id,
      patient: patient._id,
      metadata: { claimNumber: claim.claimNumber, claimAmount },
    });

    res.status(201).json({ success: true, claim });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id)
      .populate('policy')
      .populate({ path: 'patient', populate: { path: 'user', select: 'name email phone' } });
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });

    if (req.user.role === 'patient') {
      const patient = await Patient.findOne({ user: req.user._id });
      if (!patient || String(claim.patient._id || claim.patient) !== String(patient._id)) {
        return res.status(403).json({ success: false, message: 'Not allowed to view this claim' });
      }
    }
    if (req.user.role === 'insurance' && String(claim.insuranceCompany) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not allowed to view this claim' });
    }

    res.json({ success: true, claim });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
