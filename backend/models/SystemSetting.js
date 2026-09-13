import mongoose from 'mongoose';

const systemSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    updatedBy: {
      type: String,
      default: 'system',
    },
  },
  {
    timestamps: true,
  }
);

// Helper function to safely read setting with fallback
systemSettingSchema.statics.getSetting = async function (key, defaultValue = null) {
  try {
    const doc = await this.findOne({ key });
    if (!doc || doc.value === undefined || doc.value === null) {
      return defaultValue;
    }
    return doc.value;
  } catch (err) {
    console.error(`Error reading system setting "${key}":`, err.message);
    return defaultValue;
  }
};

// Helper function to upsert setting
systemSettingSchema.statics.setSetting = async function (key, value, updatedBy = 'system', description = '') {
  return await this.findOneAndUpdate(
    { key },
    { value, updatedBy, description },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema);

export default SystemSetting;
