import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  refreshToken: { type: String },
  resetPasswordCode: {
    type: String,
    default: null
  },
  resetPasswordCodeExpires: {
    type: Date,
    default: null
  },
  preferences: {
    preferredProvider: {
      type: String,
      enum: ["stablediffusion","kieai","gemini","photai","auto"], // Add more providers as needed
      default: 'auto',
    },
    prioritizeFree: {
      type: Boolean,
      default: true,
    },
  },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;