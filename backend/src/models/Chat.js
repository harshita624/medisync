'use strict';
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role:      { type: String, enum: ['user','assistant','system'], required: true },
  content:   String,
  fileType:  String,
  fileName:  String,
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const chatSchema = new mongoose.Schema({
  user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role:     { type: String, enum: ['patient','doctor'], default: 'patient' },
  title:    { type: String, default: 'New Chat' },
  messages: [messageSchema],
}, { timestamps: true });

chatSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.models.Chat || mongoose.model('Chat', chatSchema);