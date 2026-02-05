// lib/mongoStore.js
import { MongoClient } from 'mongodb';

class MongoStore {
  constructor() {
    this.mongoUrl = 'mongodb+srv://manaheva05_db_user:pFOdnnWYWLaDqH9I@inconnuboy.afh6ipt.mongodb.net/?appName=Inconnuboy';
    this.dbName = 'baileys_sessions';
    this.client = null;
    this.db = null;
    this.collection = null;
    this.connected = false;
  }

  async connect() {
    if (this.connected) return;
    
    try {
      this.client = new MongoClient(this.mongoUrl);
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.collection = this.db.collection('sessions');
      this.connected = true;
      console.log('✅ MongoDB connected for session persistence');
    } catch (error) {
      console.warn('⚠️ MongoDB connection failed:', error.message);
      this.connected = false;
    }
  }

  async saveSession(sessionId, sessionData) {
    if (!this.connected) return false;
    
    try {
      await this.collection.updateOne(
        { sessionId },
        { 
          $set: { 
            ...sessionData, 
            sessionId,
            updatedAt: new Date() 
          } 
        },
        { upsert: true }
      );
      return true;
    } catch (error) {
      console.warn(`Failed to save session ${sessionId}:`, error.message);
      return false;
    }
  }

  async loadSession(sessionId) {
    if (!this.connected) return null;
    
    try {
      const doc = await this.collection.findOne({ sessionId });
      return doc || null;
    } catch (error) {
      console.warn(`Failed to load session ${sessionId}:`, error.message);
      return null;
    }
  }

  async deleteSession(sessionId) {
    if (!this.connected) return false;
    
    try {
      await this.collection.deleteOne({ sessionId });
      return true;
    } catch (error) {
      console.warn(`Failed to delete session ${sessionId}:`, error.message);
      return false;
    }
  }

  async getAllSessions() {
    if (!this.connected) return [];
    
    try {
      const sessions = await this.collection.find({}).toArray();
      return sessions;
    } catch (error) {
      console.warn('Failed to get all sessions:', error.message);
      return [];
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.connected = false;
    }
  }
}

const mongoStore = new MongoStore();
export default mongoStore;
