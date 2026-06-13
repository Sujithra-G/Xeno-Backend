import React, { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Users, 
  Sparkles, 
  Zap, 
  CloudLightning, 
  MessageCircle,
  HelpCircle,
  Activity,
  Award
} from "lucide-react";
import Dashboard from "./components/Dashboard.tsx";
import CustomerMgmt from "./components/CustomerMgmt.tsx";
import SegmentCreator from "./components/SegmentCreator.tsx";
import CampaignEngine from "./components/CampaignEngine.tsx";
import MessageHub from "./components/MessageHub.tsx";
import CopilotChat from "./components/CopilotChat.tsx";
import { Customer, Order, Campaign, CommunicationLog, DashboardStats, SegmentCriteria } from "./types.ts";

type TabName = "dashboard" | "customers" | "segment" | "campaign" | "logs";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabName>("dashboard");
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  
  // App data state
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [communications, setCommunications] = useState<CommunicationLog[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Link state between Audience Builder and Campaign copywriter wizard
  const [linkedCriteria, setLinkedCriteria] = useState<SegmentCriteria | null>(null);
  const [linkedSegmentName, setLinkedSegmentName] = useState<string>("");

  const showNotif = (message: string, type: "success" | "error" = "success") => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 4000);
  };

  const loadAllCrmFeeds = async () => {
    setLoading(true);
    try {
      // 1. Fetch telemetry stats
      const statsRes = await fetch("/api/dashboard/stats");
      const statsData = await statsRes.json();
      setStats(statsData);

      // 2. Fetch shoppers
      const custRes = await fetch("/api/customers");
      const custData = await custRes.json();
      setCustomers(custData);

      // 3. Fetch checkouts list
      const ordRes = await fetch("/api/orders");
      const ordData = await ordRes.json();
      setOrders(ordData);

      // 4. Fetch campaigns list
      const campRes = await fetch("/api/campaigns");
      const campData = await campRes.json();
      setCampaigns(campData);

      // 5. Fetch message dispatches log
      const commRes = await fetch("/api/communications");
      const commData = await commRes.json();
      setCommunications(commData);

    } catch (err: any) {
      console.error("Failed fetching metadata feeds", err);
      showNotif("System synchronization stalled: Verify port configs.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllCrmFeeds();
  }, []);

  const handleIngestCustomer = async (cust: Omit<Customer, "id" | "createdAt" | "totalSpend" | "lastPurchaseDate">) => {
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cust)
      });
      if (res.ok) {
        showNotif(`Successfully ingested shopper ${cust.name}!`);
        await loadAllCrmFeeds(); // reload feeds
      } else {
        showNotif("Failed registering shopper profiles.", "error");
      }
    } catch (err) {
      showNotif("Operation error connecting database.", "error");
    }
  };

  const handleLogOrder = async (customerId: string, amount: number, itemsCount: number) => {
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, amount, itemsCount })
      });
      if (res.ok) {
        showNotif(`Registered order purchase receipt worth $${amount.toFixed(2)} USD!`);
        await loadAllCrmFeeds();
      } else {
        showNotif("Failed logging order receipt.", "error");
      }
    } catch (err) {
      showNotif("Error matching transactional checkout logs.", "error");
    }
  };

  const handleSegmentSelect = (criteria: SegmentCriteria, segmentName: string) => {
    setLinkedCriteria(criteria);
    setLinkedSegmentName(segmentName);
    showNotif("AI Audience Linked successfully to the Campaign copywriter! Slicing copy variations...");
  };

  const tabsConfig = [
    { id: "dashboard", label: "Performance telemetry", icon: <TrendingUp size={14} /> },
    { id: "customers", label: "Shoppers Directory", icon: <Users size={14} /> },
    { id: "segment", label: "AI Audience Builder", icon: <Sparkles size={14} /> },
    { id: "campaign", label: "AI Campaign Generator", icon: <Zap size={14} /> },
    { id: "logs", label: "Message logs stream", icon: <CloudLightning size={14} /> }
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between font-sans selection:bg-indigo-600/20 selection:text-indigo-200">
      
      {/* Upper Global Header */}
      <header className="bg-zinc-950/90 backdrop-blur-md border-b border-zinc-900 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo area */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-[0_0_12px_rgba(79,70,229,0.4)]">
                <Activity size={18} className="animate-pulse" />
              </div>
              <div>
                <span className="font-bold text-base text-zinc-100 tracking-tight font-display flex items-center gap-1.5 leading-none">
                  XENO CRM
                  <span className="inline-block px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-550 border-indigo-500/20 text-[8px] font-bold text-indigo-400 uppercase tracking-widest leading-none">AI Native</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-medium block mt-1">Take-Home Engineering Suite</span>
              </div>
            </div>

            {/* In-app Notification Banner toast */}
            {notif && (
              <div className={`hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs animate-bounce ${
                notif.type === "success" ? "bg-emerald-950/30 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}>
                <Award size={13} className="text-emerald-450 text-emerald-400" />
                <span>{notif.message}</span>
              </div>
            )}

            {/* Quick stats totals */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Overall Spend Volume</span>
                <span className="text-xs font-extrabold text-zinc-100 font-mono mt-1.5 leading-none">
                  ${stats ? stats.totalRevenue.toLocaleString() : "0.00"}
                </span>
              </div>
              
              {/* Support chatbot overlay toggle trigger */}
              <button
                onClick={() => setIsCopilotOpen(true)}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-[0_0_15px_rgba(79,70,229,0.35)] transition-all flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
              >
                <MessageCircle size={15} />
                <span className="hidden md:inline">Ask Copilot</span>
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* Main Container workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full relative">
        
        {/* Navigation tabs row */}
        <div className="border-b border-zinc-900 pb-px mb-6 flex flex-wrap gap-1.5">
          {tabsConfig.map((tab, idx) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={idx}
                onClick={() => setActiveTab(tab.id as TabName)}
                className={`py-2 px-4 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer border ${
                  isSelected 
                    ? "bg-zinc-900 text-zinc-100 border-zinc-800 shadow-[0_4px_12px_rgba(0,0,0,0.5)]" 
                    : "bg-transparent text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-zinc-900/40"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab switch logic */}
        <div className="transition-opacity duration-300">
          
          {activeTab === "dashboard" && (
            <Dashboard 
              stats={stats} 
              loading={loading} 
              onRefresh={loadAllCrmFeeds} 
            />
          )}

          {activeTab === "customers" && (
            <CustomerMgmt 
              customers={customers} 
              orders={orders} 
              onIngestCustomer={handleIngestCustomer} 
              onLogOrder={handleLogOrder} 
              loading={loading} 
            />
          )}

          {activeTab === "segment" && (
            <SegmentCreator 
              onSegmentSelect={handleSegmentSelect}
              onNavigateToCampaign={() => setActiveTab("campaign")}
            />
          )}

          {activeTab === "campaign" && (
            <CampaignEngine 
              linkedCriteria={linkedCriteria} 
              linkedSegmentName={linkedSegmentName} 
              onClearLinkedSegment={() => {
                setLinkedCriteria(null);
                setLinkedSegmentName("");
              }}
              onCampaignSent={loadAllCrmFeeds}
              onNavigateToHub={() => setActiveTab("logs")}
              campaigns={campaigns}
            />
          )}

          {activeTab === "logs" && (
            <MessageHub 
              logs={communications} 
              onRefresh={loadAllCrmFeeds} 
              loading={loading} 
            />
          )}

        </div>

      </main>

      {/* Floating Bottom Right Bubble ask copilot chatbot */}
      <button
        onClick={() => setIsCopilotOpen(true)}
        className="fixed bottom-6 right-6 p-4 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl hover:scale-105 transition-transform cursor-pointer block lg:hidden z-30"
      >
        <MessageCircle size={22} />
      </button>

      {/* Slide-out chatbot Sidebar module */}
      <CopilotChat 
        isOpen={isCopilotOpen} 
        onClose={() => setIsCopilotOpen(false)} 
      />

      {/* Footer credits info */}
      <footer className="bg-zinc-950/45 border-t border-zinc-900 py-4 mt-12 text-center text-[10px] font-medium text-zinc-500 w-full">
        <div className="max-w-7xl mx-auto px-4">
          <p>© 2026 Xeno Engineering take-home assessment. Built for the shoppers communication pipeline.</p>
        </div>
      </footer>

    </div>
  );
}
