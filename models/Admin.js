const mongoose = require('mongoose');
const AdminSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['super-admin', 'admin'], default: 'admin' },
});
module.exports = mongoose.model('Admin', AdminSchema);