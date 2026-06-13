export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";
export type CampaignChannel = "WhatsApp" | "SMS" | "Email" | "RCS";
export type CampaignStatus = "draft" | "sending" | "completed";
export type CommunicationStatus = "sending" | "sent" | "delivered" | "failed" | "opened" | "read" | "clicked";

export interface Customer {
  id: string; // fallback mapped to _id if mongodb is used
  name: string;
  email: string;
  phone: string;
  loyaltyTier: LoyaltyTier;
  totalSpend: number;
  lastPurchaseDate: string | null;
  city: string;
  preferredCategory: string;
  age: number;
  createdAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerEmail: string;
  amount: number;
  itemsCount: number;
  date: string;
  status: "completed" | "pending" | "returned";
  attributionCampaignId?: string; // links an order placed due to a campaign
}

export interface SegmentCriteria {
  naturalLanguagePrompt?: string;
  minSpend?: number;
  loyaltyTiers?: LoyaltyTier[];
  preferredCategories?: string[];
  cities?: string[];
  maxAge?: number;
  minAge?: number;
}

export interface CampaignStats {
  sent: number;
  delivered: number;
  failed: number;
  opened: number;
  read: number;
  clicked: number;
  conversions: number; // number of orders placed resulting from campaign
  revenue: number; // revenue generated from those orders
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  channel: CampaignChannel;
  subject?: string; // primarily for email
  templateText: string;
  targetSegmentCriteria: SegmentCriteria;
  status: CampaignStatus;
  stats: CampaignStats;
  createdAt: string;
}

export interface CommunicationLog {
  id: string;
  campaignId: string;
  campaignName: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  channel: CampaignChannel;
  message: string;
  status: CommunicationStatus;
  statusHistory: { status: CommunicationStatus; timestamp: string }[];
  attributionOrderAmount?: number;
  createdAt: string;
}

export interface ChannelReceivePayload {
  recipient: string;
  channel: CampaignChannel;
  message: string;
  communicationId: string;
  callbackUrl: string; // CRM Receipt callback endpoint
}

export interface ChannelCallbackPayload {
  communicationId: string;
  status: CommunicationStatus;
  timestamp: string;
  simulatePurchase?: boolean; // if clicked, we might simulate a purchase
}

export interface DashboardStats {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  activeCampaigns: number;
  totalCampaignSpendAttributed: number;
  spendByTier: Record<LoyaltyTier, number>;
  customersByTier: Record<LoyaltyTier, number>;
  transactionsOverTime: { date: string; revenue: number; count: number }[];
  campaignPerformance: {
    campaignId: string;
    name: string;
    channel: string;
    sent: number;
    clicked: number;
    conversionRate: number;
    revenue: number;
  }[];
}
