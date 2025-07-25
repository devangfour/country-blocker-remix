import mongoose from 'mongoose';

const SessionSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true
  },
  shop: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  scope: {
    type: String,
    default: null
  },
  expires: {
    type: Date,
    default: null
  },
  accessToken: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    default: null
  },
  firstName: {
    type: String,
    default: null
  },
  lastName: {
    type: String,
    default: null
  },
  email: {
    type: String,
    default: null
  },
  accountOwner: {
    type: Boolean,
    default: false
  },
  locale: {
    type: String,
    default: null
  },
  collaborator: {
    type: Boolean,
    default: false
  },
  emailVerified: {
    type: Boolean,
    default: false
  }
}, {
  collection: 'sessions',
  timestamps: false
});

const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema);

export default Session;
