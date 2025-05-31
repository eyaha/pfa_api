// ✅ models/GenerationLog.js
import mongoose from 'mongoose';

const GenerationLogSchema = new mongoose.Schema({
  historyId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImageHistory' },
  timestamp: { type: Date, default: Date.now },
  message: String,
});

export const logStep = async (historyId, message) => {
  try {
    await mongoose.model('GenerationLog').create({ historyId, message });
  } catch (err) {
    console.error('[LOG STEP ERROR]', err);
  }
};

export default mongoose.model('GenerationLog', GenerationLogSchema);
