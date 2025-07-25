import connectDB from '../db.server.js';
import Session from '../models/Session.js';

// Helper function to create a proper session object with required methods
function createSessionObject(sessionData) {
  return {
    id: sessionData._id,
    shop: sessionData.shop,
    state: sessionData.state,
    isOnline: sessionData.isOnline,
    scope: sessionData.scope,
    expires: sessionData.expires,
    accessToken: sessionData.accessToken,
    userId: sessionData.userId,
    firstName: sessionData.firstName,
    lastName: sessionData.lastName,
    email: sessionData.email,
    accountOwner: sessionData.accountOwner,
    locale: sessionData.locale,
    collaborator: sessionData.collaborator,
    emailVerified: sessionData.emailVerified,
    
    // Required methods for Shopify session compatibility
    isActive() {
      return !this.expires || new Date() < new Date(this.expires);
    },
    
    toPropertyArray() {
      return [
        { key: 'id', value: this.id },
        { key: 'shop', value: this.shop },
        { key: 'state', value: this.state },
        { key: 'isOnline', value: this.isOnline },
        { key: 'scope', value: this.scope },
        { key: 'expires', value: this.expires },
        { key: 'accessToken', value: this.accessToken },
        { key: 'userId', value: this.userId },
        { key: 'firstName', value: this.firstName },
        { key: 'lastName', value: this.lastName },
        { key: 'email', value: this.email },
        { key: 'accountOwner', value: this.accountOwner },
        { key: 'locale', value: this.locale },
        { key: 'collaborator', value: this.collaborator },
        { key: 'emailVerified', value: this.emailVerified }
      ];
    }
  };
}

export class MongooseSessionStorage {
  constructor() {
    this.ready = this.init();
  }

  async init() {
    await connectDB();
  }

  async storeSession(session) {
    await this.ready;
    
    const sessionData = {
      _id: session.id,
      shop: session.shop,
      state: session.state,
      isOnline: session.isOnline,
      scope: session.scope,
      expires: session.expires,
      accessToken: session.accessToken,
      userId: session.userId,
      firstName: session.firstName,
      lastName: session.lastName,
      email: session.email,
      accountOwner: session.accountOwner,
      locale: session.locale,
      collaborator: session.collaborator,
      emailVerified: session.emailVerified
    };

    await Session.findByIdAndUpdate(
      session.id,
      sessionData,
      { upsert: true, new: true }
    );

    return true;
  }

  async loadSession(id) {
    await this.ready;
    
    const session = await Session.findById(id);
    
    if (!session) {
      return undefined;
    }

    return createSessionObject(session);
  }

  async deleteSession(id) {
    await this.ready;
    await Session.findByIdAndDelete(id);
    return true;
  }

  async deleteSessions(ids) {
    await this.ready;
    await Session.deleteMany({ _id: { $in: ids } });
    return true;
  }

  async findSessionsByShop(shop) {
    await this.ready;
    const sessions = await Session.find({ shop });
    return sessions.map(session => createSessionObject(session));
  }
}

export const sessionStorage = new MongooseSessionStorage();
