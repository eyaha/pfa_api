import mongoose from 'mongoose';

const providerConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ["stablediffusion","kieai","gemini","photai"], // Add more provider identifiers
  },
  displayName: {
    type: String,
    required: true, // User-friendly name like or "Stable Diffusion XL"
  },
  apiBaseUrl: {
    type: String,
    required: true,
  },
  apiKeyEnvVar: {
    type: String, // Name of the environment variable holding the API key
    required: true,
  },
  // Fields to track usage and limits (might be updated dynamically)
  usageCount: {
    type: Number,
    default: 0,
  },
  quotaLimit: {
    // Define structure based on provider's limit system (e.g., requests per month, credits)
    type: mongoose.Schema.Types.Mixed,
  },
  isFreeTier: {
    type: Boolean,
    default: true, // Indicates if currently operating under a free tier
  },
  isActive: {
    type: Boolean,
    default: true, // Can be manually disabled by admin
  },
  // Cost information (can be complex, might need adjustment)
  costPerRequest: {
    type: Number,
  },
  costUnit: {
    type: String, // e.g., 'USD', 'credits'
  },
  // Add any other provider-specific configuration needed
  // e.g., specific model versions, authentication methods
  additionalConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  lastChecked: {
    type: Date, // Timestamp of the last status/quota check
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update `updatedAt` timestamp before saving
providerConfigSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const ProviderConfig = mongoose.model('ProviderConfig', providerConfigSchema);

export default ProviderConfig;

