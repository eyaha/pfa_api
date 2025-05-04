import mongoose from 'mongoose';

const imageHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true, // Index for faster queries by user
  },
  prompt: {
    type: String,
    required: true,
  },
  parameters: {
    // Store parameters used for generation (e.g., style, size, quality)
    // Flexible structure using Mixed type, or define specific fields
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  providerUsed: {
    type: String,
    required: true,
    enum: ["stablediffusion", "kieai", "gemini","photai"], // Add more as needed
  },
  imageUrl: {
    // URL or reference to the stored image
    type: String,
    // required: true, // Made optional as it's set after generation
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  cost: {
    // Optional: track cost if applicable
    type: Number,
    default: 0,
  },
  errorMessage: {
    // Store error message if generation failed
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ImageHistory = mongoose.model('ImageHistory', imageHistorySchema);

export default ImageHistory;

