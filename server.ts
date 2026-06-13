import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { db } from "./src/db/db.ts";
import { channelServiceProvider } from "./src/services/channelService.ts";
import { Customer, CampaignChannel, Order, CommunicationLog, SegmentCriteria } from "./src/types.ts";

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;
const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Initialize and seed database
db.init().then(() => {
  console.log("Database initialized successfully");
}).catch(err => {
  console.error("Database initialization failed", err);
});

// ==========================================
// 1. CRM CORE API: CUSTOMERS & ORDERS
// ==========================================

// Get list of all customers
app.get("/api/customers", async (req, res) => {
  try {
    const customers = await db.getCustomers();
    res.json(customers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Ingest new customer
app.post("/api/customers", async (req, res) => {
  try {
    const { name, email, phone, loyaltyTier, city, preferredCategory, age } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }
    const customer = await db.addCustomer({
      name,
      email,
      phone: phone || "",
      loyaltyTier: loyaltyTier || "bronze",
      city: city || "Unknown",
      preferredCategory: preferredCategory || "General",
      age: age ? Number(age) : 30,
      totalSpend: 0,
      lastPurchaseDate: null
    });
    res.status(201).json(customer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get list of all orders
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await db.getOrders();
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Ingest/log a shopper order
app.post("/api/orders", async (req, res) => {
  try {
    const { customerId, amount, itemsCount, date, status, attributionCampaignId } = req.body;
    if (!customerId || !amount) {
      return res.status(400).json({ error: "CustomerID and amount are required" });
    }
    const customers = await db.getCustomers();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const order = await db.addOrder({
      customerId,
      customerEmail: customer.email,
      amount: Number(amount),
      itemsCount: itemsCount ? Number(itemsCount) : 1,
      date: date || new Date().toISOString().split('T')[0],
      status: status || "completed",
      attributionCampaignId
    });

    res.status(201).json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. CAMPAIGNS & CHANNELS CAPABILITIES
// ==========================================

// Get all campaigns
app.get("/api/campaigns", async (req, res) => {
  try {
    const campaigns = await db.getCampaigns();
    res.json(campaigns);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create new campaign (draft)
app.post("/api/campaigns", async (req, res) => {
  try {
    const { name, description, channel, subject, templateText, targetSegmentCriteria } = req.body;
    if (!name || !channel || !templateText) {
      return res.status(400).json({ error: "Name, channel, and template text are required" });
    }

    const campaign = await db.addCampaign({
      name,
      description: description || "Custom segment campaign",
      channel,
      subject,
      templateText,
      targetSegmentCriteria: targetSegmentCriteria || {}
    });

    res.status(201).json(campaign);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get individual communication logs
app.get("/api/communications", async (req, res) => {
  try {
    const logs = await db.getCommunications();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Filter customers according to segment criteria
function filterCustomersByCriteria(customers: Customer[], criteria: SegmentCriteria): Customer[] {
  return customers.filter(c => {
    // 1. Min Spend
    if (criteria.minSpend && c.totalSpend < criteria.minSpend) {
      return false;
    }
    // 2. Loyalty tier
    if (criteria.loyaltyTiers && criteria.loyaltyTiers.length > 0) {
      if (!criteria.loyaltyTiers.includes(c.loyaltyTier)) {
        return false;
      }
    }
    // 3. Preferred category
    if (criteria.preferredCategories && criteria.preferredCategories.length > 0) {
      const catsNormalized = criteria.preferredCategories.map(cat => cat.toLowerCase());
      if (!catsNormalized.includes(c.preferredCategory.toLowerCase())) {
        return false;
      }
    }
    // 4. Cities
    if (criteria.cities && criteria.cities.length > 0) {
      const citiesNormalized = criteria.cities.map(ct => ct.toLowerCase());
      if (!citiesNormalized.includes(c.city.toLowerCase())) {
        return false;
      }
    }
    // 5. Min/Max Age
    if (criteria.minAge && c.age < criteria.minAge) return false;
    if (criteria.maxAge && c.age > criteria.maxAge) return false;

    return true;
  });
}

// Dispatch a draft campaign (performs actual outbound messaging to separate Channel service)
app.post("/api/campaigns/:id/send", async (req, res) => {
  try {
    const campaignId = req.params.id;
    const campaign = await db.getCampaignById(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (campaign.status === "sending" || campaign.status === "completed") {
      return res.status(400).json({ error: "Campaign is already sent or in-flight" });
    }

    // Identify target audience
    const customers = await db.getCustomers();
    const recipients = filterCustomersByCriteria(customers, campaign.targetSegmentCriteria);

    if (recipients.length === 0) {
      return res.status(400).json({ error: "Target segment returned zero customers. Cannot dispatch empty campaign." });
    }

    // Set campaign status in flight
    campaign.status = "sending";
    campaign.stats.sent = recipients.length;
    await db.updateCampaign(campaign);

    // Prepare individual dispatch logs & dispatch calls
    const dispatchTime = new Date().toISOString();
    const callbackUrl = `${appUrl}/api/callbacks/receipt`;

    const dispatchedLogs: CommunicationLog[] = [];

    for (const customer of recipients) {
      // Personalize message copy values
      let personalizedMsg = campaign.templateText
        .replace(/\{\{name\}\}/gi, customer.name)
        .replace(/\{\{city\}\}/gi, customer.city)
        .replace(/\{\{loyaltyTier\}\}/gi, customer.loyaltyTier)
        .replace(/\{\{preferredCategory\}\}/gi, customer.preferredCategory)
        .replace(/\{\{totalSpend\}\}/gi, `$${customer.totalSpend.toFixed(2)}`);

      const commId = "comm_" + Math.random().toString(36).substr(2, 9);
      const logItem: CommunicationLog = {
        id: commId,
        campaignId: campaign.id,
        campaignName: campaign.name,
        customerId: customer.id,
        customerEmail: customer.email,
        customerName: customer.name,
        channel: campaign.channel,
        message: personalizedMsg,
        status: "sending",
        statusHistory: [{ status: "sending", timestamp: dispatchTime }],
        createdAt: dispatchTime
      };

      // Add dispatch record in CRM database
      await db.addCommunicationLog(logItem);
      dispatchedLogs.push(logItem);

      // Async webhook trigger to our decoupled Channel Service Provider
      // We route it to our server's internal simulated API path
      fetch(`${appUrl}/api/channel/send-provider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: customer.phone || customer.email,
          channel: campaign.channel,
          message: personalizedMsg,
          communicationId: commId,
          callbackUrl
        })
      }).catch(err => {
        console.error(`Error calling channel provider for communication ID ${commId}`, err);
      });
    }

    res.json({
      message: `Successfully dispatched campaign to ${recipients.length} shoppers`,
      recipientsCount: recipients.length,
      dispatchedLogs
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. CHANNEL SERVICE CALLBACK RECEIVER PATH
// ==========================================

// Webhook endpoint exposed to the Channel Service to receive asynchronous communication logs
app.post("/api/callbacks/receipt", async (req, res) => {
  try {
    const authHeader = req.headers["x-channel-service-token"];
    if (authHeader !== "xeno_provider_token_secure_xyz") {
      return res.status(401).json({ error: "Unauthorized Service Token" });
    }

    const { communicationId, status, timestamp, simulatePurchase } = req.body;
    if (!communicationId || !status) {
      return res.status(400).json({ error: "Missing required callback payloads" });
    }

    // Retrieve previous individual communication log
    const commLog = await db.getCommunicationById(communicationId);
    if (!commLog) {
      console.error(`[Callback Handler] Order log not found for ID: ${communicationId}`);
      return res.status(404).json({ error: "Communication log not found" });
    }

    // Transition status and push history log
    commLog.status = status;
    commLog.statusHistory.push({ status, timestamp });

    // Handle high-value customer purchase attribution simulation
    if (simulatePurchase) {
      // Calculate randomized conversion ticket values
      const baseProductPrice = commLog.channel === "WhatsApp" ? 149.00 : 79.50;
      const orderAmount = Number((baseProductPrice + Math.random() * 80).toFixed(2));
      
      commLog.attributionOrderAmount = orderAmount;

      // Add a real purchase order in DB, linked to this campaign to show real funnel performance!
      await db.addOrder({
        customerId: commLog.customerId,
        customerEmail: commLog.customerEmail,
        amount: orderAmount,
        itemsCount: Math.ceil(Math.random() * 3),
        date: new Date().toISOString().split('T')[0],
        status: "completed",
        attributionCampaignId: commLog.campaignId
      });

      console.log(`[Attribution Match] Attributed Order of $${orderAmount} from shopper ${commLog.customerName} back to Campaign: ${commLog.campaignName}`);
    }

    // Persist communication log update
    await db.updateCommunicationLog(commLog);

    res.json({ status: "success", received: true });

  } catch (err: any) {
    console.error("Callback endpoint crashed", err);
    res.status(500).json({ error: err.message });
  }
});

// Decoupled Simulation entry point represent the external messaging hub
app.post("/api/channel/send-provider", async (req, res) => {
  try {
    const payload = req.body; // ChannelReceivePayload
    // Pass it down to the asynchronous lifecycle simulation engine
    channelServiceProvider.processSimulatedMessage(payload);
    res.json({ providerStatus: "enqueued", message: "Dispatched to provider wire" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. INTELLIGENT AI-NATIVE CAPABILITIES
// ==========================================

// AI Natural Language Segmentation: Takes marketer text and parses it into filters
app.post("/api/ai/segment", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Segment prompt description is required" });
    }

    // We use gemini-3.5-flash as the recommended basic text-based tool schema
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are an AI Segmentation Engineer. Parse this natural language marketer request into a structured JSON configuration matching the Schema provided below.
Marketer prompt: "${prompt}"

Current date is: 2026-06-13.

Schema definition guidelines:
- minSpend: (number) Minimum spend threshold.
- loyaltyTiers: Array of ("bronze" | "silver" | "gold" | "platinum")
- preferredCategories: Array of shopper product categories (e.g., ["Fashion", "Coffee", "Beauty", "Electronics"])
- cities: Array of matching cities.
- maxAge: (number) Maximum customer shopper age.
- minAge: (number) Minimum customer shopper age.

Ensure you ONLY return valid JSON matching this schema. If any filter criteria is not mentioned in the prompt, omit it or leave it structure-free.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            minSpend: { type: Type.NUMBER, description: "minimum shopping spending amount required" },
            loyaltyTiers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Allowed loyalty tiers: bronze, silver, gold, platinum"
            },
            preferredCategories: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Preferred consumer categories like Fashion, Coffee, Beauty"
            },
            cities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Shopper location city matches"
            },
            maxAge: { type: Type.NUMBER },
            minAge: { type: Type.NUMBER },
          }
        }
      }
    });

    const parsedCriteria: SegmentCriteria = JSON.parse(response.text || "{}");
    
    // Perform database lookup based on Gemini-extracted JSON filters
    const allCustomers = await db.getCustomers();
    const matched = filterCustomersByCriteria(allCustomers, parsedCriteria);

    res.json({
      success: true,
      criteria: parsedCriteria,
      matchedCount: matched.length,
      matchedCustomers: matched.map(c => ({
        id: c.id,
        name: c.name,
        email: c.email,
        totalSpend: c.totalSpend,
        city: c.city,
        loyaltyTier: c.loyaltyTier,
        preferredCategory: c.preferredCategory
      }))
    });

  } catch (err: any) {
    console.error("AI segmenting failed", err);
    res.status(500).json({ error: err.message });
  }
});

// AI Personalization copy and template copywriter
app.post("/api/ai/generate-campaign", async (req, res) => {
  try {
    const { segmentSummary, channel, promotionDetails } = req.body;
    if (!channel || !promotionDetails) {
      return res.status(400).json({ error: "Channel and promotion details are required" });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are an expert consumer copywriter for Xeno Mini CRM. Generate a high-converting personalized message template for a customer campaign.
Target Segment Parameters: ${segmentSummary || "General customers"}
Outbound Delivery Channel: ${channel}
Promotion details: "${promotionDetails}"

Campaign Message Guidelines:
- Keep copy crisp, contextual, and optimized for the channel. (Emails can be longer, WhatsApp/SMS/RCS must be brief, engaging, with emojis and link placeholders).
- You MUST utilize personalization merge tags appropriately inside the template text:
  - {{name}} : customer first name
  - {{city}} : customer resident city
  - {{loyaltyTier}} : Bronze, Silver, Gold, Platinum
  - {{preferredCategory}} : Fashion, Coffee, etc.
- Also suggest a compelling Campaign Header/Title name.

Return JSON response matching:
{
  "name": "Engaging campaign title",
  "description": "Short explanation of creative pitch used",
  "templateText": "The body text of the message containing merge holders"
}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            templateText: { type: Type.STRING }
          },
          required: ["name", "description", "templateText"]
        }
      }
    });

    const bodyData = JSON.parse(response.text || "{}");
    res.json(bodyData);

  } catch (err: any) {
    console.error("Copywriting creation failed", err);
    res.status(500).json({ error: err.message });
  }
});

// AI Copilot direct chatbot endpoint
app.post("/api/ai/copilot-chat", async (req, res) => {
  try {
    const { message, chatHistory } = req.body;
    if (!message) {
      return res.status(400).json({ error: "User query is required" });
    }

    const customers = await db.getCustomers();
    const campaigns = await db.getCampaigns();
    const orders = await db.getOrders();

    const dataContext = {
      customerCount: customers.length,
      ordersCount: orders.length,
      revenueTotal: orders.reduce((sum, o) => sum + o.amount, 0),
      tierBreakdown: {
        platinum: customers.filter(c => c.loyaltyTier === "platinum").length,
        gold: customers.filter(c => c.loyaltyTier === "gold").length,
        silver: customers.filter(c => c.loyaltyTier === "silver").length,
        bronze: customers.filter(c => c.loyaltyTier === "bronze").length,
      },
      categories: ["Fashion", "Coffee", "Beauty", "Electronics"]
    };

    const promptText = `User query: "${message}"

Below is the live CRM system context to ground your answer:
- Active Shoppers (Total Customers): ${dataContext.customerCount}
- Completed Orders: ${dataContext.ordersCount}
- Overall Store Revenue Incurred: $${dataContext.revenueTotal.toFixed(2)}
- Loyalty tiers breakdown: Platinum (${dataContext.tierBreakdown.platinum}), Gold (${dataContext.tierBreakdown.gold}), Silver (${dataContext.tierBreakdown.silver}), Bronze (${dataContext.tierBreakdown.bronze})

Reply conversationally, highlighting how Xeno CRM features can help them (AI segmentations, automated template copies, real-time message callback tracking). Keep your tips practical and marketing-focused! Minimize math steps and make suggestions immediately actionable.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
    });

    res.json({ reply: response.text });
  } catch (err: any) {
    console.error("AI Copilot chat failed", err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. CRM SYSTEM PERFORMANCE DASHBOARD APIS
// ==========================================

app.get("/api/dashboard/stats", async (req, res) => {
  try {
    const customers = await db.getCustomers();
    const orders = await db.getOrders();
    const campaigns = await db.getCampaigns();

    // Summing totals
    const totalCustomers = customers.length;
    const totalOrders = orders.length;
    
    // Accumulate overall store revenue & attributed spend
    const totalRevenue = orders.reduce((sum, o) => sum + o.amount, 0);
    const activeCampaigns = campaigns.filter(c => c.status === "sending" || c.status === "completed").length;
    
    const totalCampaignSpendAttributed = campaigns.reduce((sum, c) => sum + (c.stats.revenue || 0), 0);

    // Distribution counters
    const customersByTier: Record<string, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    const spendByTier: Record<string, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };

    customers.forEach(c => {
      if (customersByTier[c.loyaltyTier] !== undefined) {
        customersByTier[c.loyaltyTier]++;
      }
    });

    orders.forEach(o => {
      const cust = customers.find(c => c.id === o.customerId);
      if (cust && spendByTier[cust.loyaltyTier] !== undefined) {
        spendByTier[cust.loyaltyTier] += o.amount;
      }
    });

    // Grouping orders over the last couple records of time (trend lines chart)
    // Sort all completed orders by date values
    const sortedOrders = [...orders].sort((a, b) => a.date.localeCompare(b.date));
    const dailyMap: Record<string, { revenue: number; count: number }> = {};
    
    sortedOrders.forEach(o => {
      const d = o.date;
      if (!dailyMap[d]) {
        dailyMap[d] = { revenue: 0, count: 0 };
      }
      dailyMap[d].revenue += o.amount;
      dailyMap[d].count += 1;
    });

    const transactionsOverTime = Object.keys(dailyMap).map(date => ({
      date,
      revenue: Math.round(dailyMap[date].revenue),
      count: dailyMap[date].count
    })).slice(-10); // last 10 days of timeline transactions

    // Individual campaigns stats map
    const campaignPerformance = campaigns.map(c => {
      const sent = c.stats.sent || 0;
      const clicked = c.stats.clicked || 0;
      const conversionRate = sent > 0 ? Number(((c.stats.conversions / sent) * 100).toFixed(1)) : 0;

      return {
        campaignId: c.id,
        name: c.name,
        channel: c.channel,
        sent,
        clicked,
        conversionRate,
        revenue: c.stats.revenue || 0
      };
    });

    res.json({
      totalCustomers,
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      activeCampaigns,
      totalCampaignSpendAttributed: Math.round(totalCampaignSpendAttributed * 100) / 100,
      spendByTier,
      customersByTier,
      transactionsOverTime,
      campaignPerformance
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. FRAMEWORK SERVING MIDDLEWARE (VITE / DIST)
// ==========================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Mount Vite middleware in development environment for client HMR
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Static production build directories routing
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Full-Stack CRM] Server online at http://localhost:${PORT}`);
  });
}

startServer();
