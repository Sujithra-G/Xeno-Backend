import fs from "fs";
import path from "path";
import { MongoClient, Db } from "mongodb";
import { Customer, Order, Campaign, CommunicationLog, LoyaltyTier, CampaignChannel } from "../types.ts";

// Database storage configurations
const LOCAL_DB_PATH = path.join(process.cwd(), "src", "db", "data_store.json");

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let isUsingMongo = false;

// Safe Lazy-init for MongoDB
async function getMongoDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return null;
  }
  if (mongoDb) return mongoDb;

  try {
    mongoClient = new MongoClient(uri, {
      connectTimeoutMS: 5000,
      socketTimeoutMS: 5000,
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db("xeno_mini_crm");
    isUsingMongo = true;
    console.log("Successfully connected to MongoDB Atlas");
    return mongoDb;
  } catch (err) {
    console.error("Failed to connect to MongoDB Atlas, falling back to JSON storage", err);
    isUsingMongo = false;
    return null;
  }
}

// Interfaces for our aggregated json file structure
interface InMemData {
  customers: Customer[];
  orders: Order[];
  campaigns: Campaign[];
  communications: CommunicationLog[];
}

// Initial seed data to run immediately out of the box with highly realistic shopping items
const SAMPLE_CUSTOMERS: Customer[] = [
  {
    id: "cust_suji_akshi",
    name: "Suji Akshi",
    email: "sujiakshi2528@gmail.com",
    phone: "+1555019922",
    loyaltyTier: "platinum",
    totalSpend: 549.99,
    lastPurchaseDate: "2026-06-10",
    city: "Seattle",
    preferredCategory: "Fashion",
    age: 24,
    createdAt: "2026-01-15T08:30:00Z",
  },
  {
    id: "cust1",
    name: "Emily Chen",
    email: "emily.chen@example.com",
    phone: "+1555021345",
    loyaltyTier: "platinum",
    totalSpend: 1250.50,
    lastPurchaseDate: "2026-06-12",
    city: "San Francisco",
    preferredCategory: "Fashion",
    age: 29,
    createdAt: "2026-01-20T10:15:00Z",
  },
  {
    id: "cust2",
    name: "Marcus Rodriguez",
    email: "marcus.rod@example.com",
    phone: "+1555043921",
    loyaltyTier: "gold",
    totalSpend: 345.20,
    lastPurchaseDate: "2026-05-28",
    city: "Seattle",
    preferredCategory: "Coffee",
    age: 34,
    createdAt: "2026-02-05T14:22:00Z",
  },
  {
    id: "cust3",
    name: "Sarah Jenkins",
    email: "sarah.j@example.com",
    phone: "+1555081920",
    loyaltyTier: "silver",
    totalSpend: 120.00,
    lastPurchaseDate: "2026-06-02",
    city: "New York",
    preferredCategory: "Beauty",
    age: 27,
    createdAt: "2026-03-12T11:45:00Z",
  },
  {
    id: "cust4",
    name: "Hiroshi Tanaka",
    email: "hiroshi.t@example.com",
    phone: "+1555029188",
    loyaltyTier: "bronze",
    totalSpend: 45.00,
    lastPurchaseDate: "2026-04-12",
    city: "Boston",
    preferredCategory: "Coffee",
    age: 42,
    createdAt: "2026-03-15T09:12:00Z",
  },
  {
    id: "cust5",
    name: "Chloe Mercer",
    email: "chloe.mercer@example.com",
    phone: "+1555077221",
    loyaltyTier: "platinum",
    totalSpend: 980.00,
    lastPurchaseDate: "2026-06-08",
    city: "New York",
    preferredCategory: "Fashion",
    age: 31,
    createdAt: "2026-01-10T16:40:00Z",
  },
  {
    id: "cust6",
    name: "David Vance",
    email: "david.vance@example.com",
    phone: "+1555099234",
    loyaltyTier: "silver",
    totalSpend: 185.50,
    lastPurchaseDate: "2026-05-15",
    city: "Austin",
    preferredCategory: "Electronics",
    age: 39,
    createdAt: "2026-02-22T08:05:00Z",
  },
  {
    id: "cust7",
    name: "Amanda Ross",
    email: "amanda.ross@example.com",
    phone: "+1555038291",
    loyaltyTier: "gold",
    totalSpend: 440.00,
    lastPurchaseDate: "2026-06-11",
    city: "San Francisco",
    preferredCategory: "Beauty",
    age: 26,
    createdAt: "2026-02-18T14:50:00Z",
  },
  {
    id: "cust8",
    name: "Liam Gallagher",
    email: "liam.g@example.com",
    phone: "+1555022199",
    loyaltyTier: "bronze",
    totalSpend: 25.00,
    lastPurchaseDate: "2026-05-01",
    city: "Boston",
    preferredCategory: "Coffee",
    age: 48,
    createdAt: "2026-04-01T10:10:00Z",
  },
  {
    id: "cust9",
    name: "Sophia Martinez",
    email: "sophia.m@example.com",
    phone: "+1555011883",
    loyaltyTier: "platinum",
    totalSpend: 1120.00,
    lastPurchaseDate: "2026-06-05",
    city: "Austin",
    preferredCategory: "Fashion",
    age: 28,
    createdAt: "2026-01-28T13:20:00Z",
  }
];

const SAMPLE_ORDERS: Order[] = [
  { id: "ord_suji_1", customerId: "cust_suji_akshi", customerEmail: "sujiakshi2528@gmail.com", amount: 249.99, itemsCount: 2, date: "2026-03-10", status: "completed" },
  { id: "ord_suji_2", customerId: "cust_suji_akshi", customerEmail: "sujiakshi2528@gmail.com", amount: 300.00, itemsCount: 3, date: "2026-06-10", status: "completed" },
  
  { id: "ord1", customerId: "cust1", customerEmail: "emily.chen@example.com", amount: 450.50, itemsCount: 3, date: "2026-02-15", status: "completed" },
  { id: "ord2", customerId: "cust1", customerEmail: "emily.chen@example.com", amount: 800.00, itemsCount: 4, date: "2026-06-12", status: "completed" },
  
  { id: "ord3", customerId: "cust2", customerEmail: "marcus.rod@example.com", amount: 145.20, itemsCount: 1, date: "2026-02-10", status: "completed" },
  { id: "ord4", customerId: "cust2", customerEmail: "marcus.rod@example.com", amount: 200.00, itemsCount: 2, date: "2026-05-28", status: "completed" },
  
  { id: "ord5", customerId: "cust3", customerEmail: "sarah.j@example.com", amount: 120.00, itemsCount: 2, date: "2026-06-02", status: "completed" },
  
  { id: "ord6", customerId: "cust4", customerEmail: "hiroshi.t@example.com", amount: 45.00, itemsCount: 3, date: "2026-04-12", status: "completed" },
  
  { id: "ord7", customerId: "cust5", customerEmail: "chloe.mercer@example.com", amount: 500.00, itemsCount: 2, date: "2026-02-18", status: "completed" },
  { id: "ord8", customerId: "cust5", customerEmail: "chloe.mercer@example.com", amount: 480.00, itemsCount: 3, date: "2026-06-08", status: "completed" },
  
  { id: "ord9", customerId: "cust6", customerEmail: "david.vance@example.com", amount: 185.50, itemsCount: 5, date: "2026-05-15", status: "completed" },
  
  { id: "ord10", customerId: "cust7", customerEmail: "amanda.ross@example.com", amount: 220.00, itemsCount: 2, date: "2026-03-01", status: "completed" },
  { id: "ord11", customerId: "cust7", customerEmail: "amanda.ross@example.com", amount: 220.00, itemsCount: 1, date: "2026-06-11", status: "completed" },
  
  { id: "ord12", customerId: "cust8", customerEmail: "david.vance@example.com", amount: 25.00, itemsCount: 1, date: "2026-05-01", status: "completed" },
  
  { id: "ord13", customerId: "cust9", customerEmail: "sophia.m@example.com", amount: 620.00, itemsCount: 3, date: "2026-02-20", status: "completed" },
  { id: "ord14", customerId: "cust9", customerEmail: "sophia.m@example.com", amount: 500.00, itemsCount: 2, date: "2026-06-05", status: "completed" }
];

const SAMPLE_CAMPAIGNS: Campaign[] = [
  {
    id: "camp1",
    name: "VIP Platinum Exclusive Spark 💅",
    description: "Launch premium rewards campaign for highest spenders encouraging fashion collections updates.",
    channel: "WhatsApp",
    templateText: "Hey {{name}}! As our valued Platinum client, we've got an exclusive 25% off pre-release fashion items. Shop premium at: https://fashion.xeno.example/vip-platinum",
    targetSegmentCriteria: {
      minSpend: 500,
      loyaltyTiers: ["platinum"]
    },
    status: "completed",
    stats: {
      sent: 3,
      delivered: 3,
      failed: 0,
      opened: 3,
      read: 2,
      clicked: 2,
      conversions: 1,
      revenue: 800.00
    },
    createdAt: "2026-06-01T08:00:00Z"
  },
  {
    id: "camp2",
    name: "Weekend Coffee Lovers SMS ☕",
    description: "Blast a quick weekend reminder nudge for coffee chains with simulated outcomes.",
    channel: "SMS",
    templateText: "Hey {{name}}! Stop by your local cafe this Saturday. Buy 2 coffees, get 1 free! Present this SMS for offer coupon.",
    targetSegmentCriteria: {
      preferredCategories: ["Coffee"]
    },
    status: "completed",
    stats: {
      sent: 3,
      delivered: 3,
      failed: 0,
      opened: 2,
      read: 2,
      clicked: 1,
      conversions: 0,
      revenue: 0
    },
    createdAt: "2026-06-05T14:00:00Z"
  }
];

const SAMPLE_COMMUNICATIONS: CommunicationLog[] = [
  {
    id: "comm1",
    campaignId: "camp1",
    campaignName: "VIP Platinum Exclusive Spark 💅",
    customerId: "cust1",
    customerEmail: "emily.chen@example.com",
    customerName: "Emily Chen",
    channel: "WhatsApp",
    message: "Hey Emily Chen! As our valued Platinum client, we've got an exclusive 25% off pre-release fashion items. Shop premium at: https://fashion.xeno.example/vip-platinum",
    status: "clicked",
    statusHistory: [
      { status: "sending", timestamp: "2026-06-01T08:00:10Z" },
      { status: "sent", timestamp: "2026-06-01T08:00:15Z" },
      { status: "delivered", timestamp: "2026-06-01T08:01:00Z" },
      { status: "opened", timestamp: "2026-06-01T08:05:22Z" },
      { status: "read", timestamp: "2026-06-01T08:05:30Z" },
      { status: "clicked", timestamp: "2026-06-01T08:12:00Z" }
    ],
    attributionOrderAmount: 800.00,
    createdAt: "2026-06-01T08:00:00Z"
  },
  {
    id: "comm2",
    campaignId: "camp1",
    campaignName: "VIP Platinum Exclusive Spark 💅",
    customerId: "cust_suji_akshi",
    customerEmail: "sujiakshi2528@gmail.com",
    customerName: "Suji Akshi",
    channel: "WhatsApp",
    message: "Hey Suji Akshi! As our valued Platinum client, we've got an exclusive 25% off pre-release fashion items. Shop premium at: https://fashion.xeno.example/vip-platinum",
    status: "read",
    statusHistory: [
      { status: "sending", timestamp: "2026-06-01T08:00:10Z" },
      { status: "sent", timestamp: "2026-06-01T08:00:18Z" },
      { status: "delivered", timestamp: "2026-06-01T08:01:20Z" },
      { status: "opened", timestamp: "2026-06-01T08:10:00Z" },
      { status: "read", timestamp: "2026-06-01T08:11:00Z" }
    ],
    createdAt: "2026-06-01T08:00:00Z"
  },
  {
    id: "comm3",
    campaignId: "camp1",
    campaignName: "VIP Platinum Exclusive Spark 💅",
    customerId: "cust5",
    customerEmail: "chloe.mercer@example.com",
    customerName: "Chloe Mercer",
    channel: "WhatsApp",
    message: "Hey Chloe Mercer! As our valued Platinum client, we've got an exclusive 25% off pre-release fashion items. Shop premium at: https://fashion.xeno.example/vip-platinum",
    status: "opened",
    statusHistory: [
      { status: "sending", timestamp: "2026-06-01T08:00:10Z" },
      { status: "sent", timestamp: "2026-06-01T08:00:20Z" },
      { status: "delivered", timestamp: "2026-06-01T08:01:50Z" },
      { status: "opened", timestamp: "2026-06-01T08:55:00Z" }
    ],
    createdAt: "2026-06-01T08:00:00Z"
  }
];

// Read local JSON helper
function readLocalData(): InMemData {
  try {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      // Ensure directory exists
      const dir = path.dirname(LOCAL_DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const initial: InMemData = {
        customers: SAMPLE_CUSTOMERS,
        orders: SAMPLE_ORDERS,
        campaigns: SAMPLE_CAMPAIGNS,
        communications: SAMPLE_COMMUNICATIONS,
      };
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    const data = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Local read failed, using empty structure", err);
    return { customers: [], orders: [], campaigns: [], communications: [] };
  }
}

// Write local JSON helper
function writeLocalData(data: InMemData): void {
  try {
    const dir = path.dirname(LOCAL_DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Local write failed", err);
  }
}

// Global Core Data Service Database Operations
export const db = {
  // 1. Core initialization and seeding (safely pre-populates MongoDB if it is selected and empty)
  async init() {
    const mDb = await getMongoDb();
    if (mDb) {
      try {
        const custCount = await mDb.collection("customers").countDocuments();
        if (custCount === 0) {
          await mDb.collection("customers").insertMany(SAMPLE_CUSTOMERS);
          await mDb.collection("orders").insertMany(SAMPLE_ORDERS);
          await mDb.collection("campaigns").insertMany(SAMPLE_CAMPAIGNS);
          await mDb.collection("communications").insertMany(SAMPLE_COMMUNICATIONS);
          console.log("Seeded MongoDB Collections successfully");
        }
      } catch (err) {
        console.error("MongoDB seeding error, falls back to JSON local file db state", err);
      }
    } else {
      // Verify local file exists & load it
      readLocalData();
      console.log("Local filesystem data initialized successfully: " + LOCAL_DB_PATH);
    }
  },

  // 2. Customers operations
  async getCustomers(): Promise<Customer[]> {
    const mDb = await getMongoDb();
    if (mDb) {
      const items = await mDb.collection("customers").find({}).toArray();
      return items.map((x: any) => ({ ...x, id: x.id || x._id.toString() })) as Customer[];
    }
    return readLocalData().customers;
  },

  async addCustomer(customer: Omit<Customer, "id" | "createdAt">): Promise<Customer> {
    const newCustomer: Customer = {
      ...customer,
      id: "cust_" + Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    const mDb = await getMongoDb();
    if (mDb) {
      await mDb.collection("customers").insertOne(newCustomer);
      return newCustomer;
    }
    const store = readLocalData();
    store.customers.push(newCustomer);
    writeLocalData(store);
    return newCustomer;
  },

  async addCustomersBulk(customers: Customer[]): Promise<void> {
    const mDb = await getMongoDb();
    if (mDb) {
      await mDb.collection("customers").insertMany(customers);
      return;
    }
    const store = readLocalData();
    // Prevent duplicate IDs
    const currentIds = new Set(store.customers.map(c => c.id));
    customers.forEach(c => {
      if (!currentIds.has(c.id)) {
        store.customers.push(c);
      }
    });
    writeLocalData(store);
  },

  async updateCustomerSpend(customerId: string, spendAmount: number, purchaseDate: string): Promise<void> {
    const mDb = await getMongoDb();
    if (mDb) {
      await mDb.collection("customers").updateOne(
        { id: customerId },
        { 
          $inc: { totalSpend: spendAmount },
          $set: { lastPurchaseDate: purchaseDate }
        }
      );
      return;
    }
    const store = readLocalData();
    const customer = store.customers.find(c => c.id === customerId);
    if (customer) {
      customer.totalSpend += spendAmount;
      customer.lastPurchaseDate = purchaseDate;
      writeLocalData(store);
    }
  },

  // 3. Orders operations
  async getOrders(): Promise<Order[]> {
    const mDb = await getMongoDb();
    if (mDb) {
      const items = await mDb.collection("orders").find({}).toArray();
      return items.map((x: any) => ({ ...x, id: x.id || x._id.toString() })) as Order[];
    }
    return readLocalData().orders;
  },

  async addOrder(order: Omit<Order, "id">): Promise<Order> {
    const newOrder: Order = {
      ...order,
      id: "ord_" + Math.random().toString(36).substr(2, 9),
    };
    const mDb = await getMongoDb();
    if (mDb) {
      await mDb.collection("orders").insertOne(newOrder);
    } else {
      const store = readLocalData();
      store.orders.push(newOrder);
      writeLocalData(store);
    }

    // Update the customer total spend and last purchase date atomically if found
    await this.updateCustomerSpend(order.customerId, order.amount, order.date);
    return newOrder;
  },

  // 4. Campaigns operations
  async getCampaigns(): Promise<Campaign[]> {
    const mDb = await getMongoDb();
    if (mDb) {
      const items = await mDb.collection("campaigns").find({}).toArray();
      return items.map((x: any) => ({ ...x, id: x.id || x._id.toString() })) as Campaign[];
    }
    return readLocalData().campaigns;
  },

  async getCampaignById(campaignId: string): Promise<Campaign | null> {
    const mDb = await getMongoDb();
    if (mDb) {
      const item = await mDb.collection("campaigns").findOne({ id: campaignId });
      if (!item) return null;
      return { ...item, id: item.id || item._id.toString() } as unknown as Campaign;
    }
    return readLocalData().campaigns.find(c => c.id === campaignId) || null;
  },

  async addCampaign(campaign: Omit<Campaign, "id" | "createdAt" | "stats" | "status">): Promise<Campaign> {
    const newCampaign: Campaign = {
      ...campaign,
      id: "camp_" + Math.random().toString(36).substr(2, 9),
      status: "draft",
      stats: {
        sent: 0,
        delivered: 0,
        failed: 0,
        opened: 0,
        read: 0,
        clicked: 0,
        conversions: 0,
        revenue: 0,
      },
      createdAt: new Date().toISOString(),
    };
    const mDb = await getMongoDb();
    if (mDb) {
      await mDb.collection("campaigns").insertOne(newCampaign);
      return newCampaign;
    }
    const store = readLocalData();
    store.campaigns.push(newCampaign);
    writeLocalData(store);
    return newCampaign;
  },

  async updateCampaign(campaign: Campaign): Promise<void> {
    const mDb = await getMongoDb();
    if (mDb) {
      await mDb.collection("campaigns").updateOne({ id: campaign.id }, { $set: campaign });
      return;
    }
    const store = readLocalData();
    const idx = store.campaigns.findIndex(c => c.id === campaign.id);
    if (idx !== -1) {
      store.campaigns[idx] = campaign;
      writeLocalData(store);
    }
  },

  // 5. Communication logs (individual delivery logs for tracking lifecycle)
  async getCommunications(): Promise<CommunicationLog[]> {
    const mDb = await getMongoDb();
    if (mDb) {
      const items = await mDb.collection("communications").find({}).toArray();
      return items.map((x: any) => ({ ...x, id: x.id || x._id.toString() })) as CommunicationLog[];
    }
    return readLocalData().communications;
  },

  async getCommunicationById(commId: string): Promise<CommunicationLog | null> {
    const mDb = await getMongoDb();
    if (mDb) {
      const item = await mDb.collection("communications").findOne({ id: commId });
      if (!item) return null;
      return { ...item, id: item.id || item._id.toString() } as unknown as CommunicationLog;
    }
    return readLocalData().communications.find(c => c.id === commId) || null;
  },

  async addCommunicationLog(log: CommunicationLog): Promise<void> {
    const mDb = await getMongoDb();
    if (mDb) {
      await mDb.collection("communications").insertOne(log);
      return;
    }
    const store = readLocalData();
    store.communications.push(log);
    writeLocalData(store);
  },

  async updateCommunicationLog(log: CommunicationLog): Promise<void> {
    const mDb = await getMongoDb();
    if (mDb) {
      await mDb.collection("communications").updateOne({ id: log.id }, { $set: log });
    } else {
      const store = readLocalData();
      const idx = store.communications.findIndex(c => c.id === log.id);
      if (idx !== -1) {
        store.communications[idx] = log;
        writeLocalData(store);
      }
    }

    // Atomically recalculate campaign level stats upon individual log updates
    await this.aggregateCampaignStats(log.campaignId);
  },

  // Aggregation helper: keeps stats matching the logs
  async aggregateCampaignStats(campaignId: string): Promise<void> {
    const mDb = await getMongoDb();
    let logs: CommunicationLog[] = [];
    if (mDb) {
      const result = await mDb.collection("communications").find({ campaignId }).toArray();
      logs = result.map((x: any) => ({ ...x, id: x.id || x._id.toString() })) as CommunicationLog[];
    } else {
      logs = readLocalData().communications.filter(c => c.campaignId === campaignId);
    }

    const stats = {
      sent: 0,
      delivered: 0,
      failed: 0,
      opened: 0,
      read: 0,
      clicked: 0,
      conversions: 0,
      revenue: 0,
    };

    logs.forEach(log => {
      stats.sent++;
      if (log.status === "delivered") stats.delivered++;
      else if (log.status === "failed") stats.failed++;
      else if (log.status === "opened") {
        stats.delivered++;
        stats.opened++;
      } else if (log.status === "read") {
        stats.delivered++;
        stats.opened++;
        stats.read++;
      } else if (log.status === "clicked") {
        stats.delivered++;
        stats.opened++;
        stats.read++;
        stats.clicked++;
      }

      if (log.attributionOrderAmount && log.attributionOrderAmount > 0) {
        stats.conversions++;
        stats.revenue += log.attributionOrderAmount;
      }
    });

    const campaign = await this.getCampaignById(campaignId);
    if (campaign) {
      campaign.stats = stats;
      // Mark campaign completed if dispatch logs show items are sent & updated
      if (campaign.status === "sending" && stats.sent > 0) {
        campaign.status = "completed";
      }
      await this.updateCampaign(campaign);
    }
  }
};
