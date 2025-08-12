import mongoose from 'mongoose';

const CountryBlockerSettingsSchema = new mongoose.Schema({
  shop: {
    type: String,
    required: true,
    unique: true
  },
  blockingMode: {
    type: String,
    default: 'allow'
  },
  countryList: {
    type: String,
    default: ''
  },
  blockPageTitle: {
    type: String,
    default: 'Access Restricted'
  },
  blockPageDescription: {
    type: String,
    default: 'This store is not available in your country.'
  },
  textColor: {
    type: String,
    default: '#ffffff'
  },
  backgroundColor: {
    type: String,
    default: '#FFFFFF'
  },
  boxBackgroundColor: {
    type: String,
    default: '#ff8901'
  },
  logoUrl: {
    type: String,
    default: null
  },
  blockedIpAddresses: {
    type: String,
    default: ''
  },
  blockBy: {
    type: String,
    default: 'country',
    enum: ['country', 'ip']
  },
  appEmbedEnabled: {
    type: Boolean,
    default: false
  }
}, {
  collection: 'country_blocker_settings',
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

const CountryBlockerSettings = mongoose.models.CountryBlockerSettings || mongoose.model('CountryBlockerSettings', CountryBlockerSettingsSchema);

export default CountryBlockerSettings;
