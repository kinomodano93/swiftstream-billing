import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  MessageSquare,
  X,
  Send,
  Bot,
  User,
  Copy,
  Check,
  RefreshCw,
  Zap,
  HelpCircle,
  ShieldCheck,
  Globe,
  Radio,
  Minimize2,
  Maximize2,
  ChevronDown,
  Settings,
  Key,
  Cpu,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Calendar,
  CreditCard,
  Wrench,
  Eye,
  EyeOff,
  Layers,
  CheckCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, AiChatMessage } from '../../types';
import {
  askGeminiAiAssistant,
  testGeminiApiKey,
  AskGeminiAction,
  GeminiAiMessage,
} from '../../utils/geminiService';

interface GeminiAiAssistantProps {
  mode: 'homepage' | 'client' | 'admin';
  activeCustomer?: Customer | null;
  onOpenSignUp?: (planId?: string, defaultBarangay?: string, defaultMunicipality?: string) => void;
}

export const GeminiAiAssistant: React.FC<GeminiAiAssistantProps> = ({
  mode,
  activeCustomer,
  onOpenSignUp,
}) => {
  const {
    businessProfile,
    updateBusinessProfile,
    plans,
    customers,
    invoices,
    repairOrders,
    mikrotikDevices,
    napBoxes,
    expenses,
    operationalBills,
    coverageAreas,
    setActiveTab,
  } = useApp();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState<boolean>(false);

  // Settings drawer state
  const [tempApiKey, setTempApiKey] = useState<string>(
    businessProfile.apiKeys.geminiApiKey || ''
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    businessProfile.apiKeys.geminiModel || 'gemini-2.5-flash'
  );
  const [showKeyPlaintext, setShowKeyPlaintext] = useState<boolean>(false);
  const [isTestingKey, setIsTestingKey] = useState<boolean>(false);
  const [testFeedback, setTestFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync settings inputs when business profile updates
  useEffect(() => {
    setTempApiKey(businessProfile.apiKeys.geminiApiKey || '');
    setSelectedModel(businessProfile.apiKeys.geminiModel || 'gemini-2.5-flash');
  }, [businessProfile.apiKeys.geminiApiKey, businessProfile.apiKeys.geminiModel]);

  // Determine initial greeting and default actions based on mode
  const getInitialGreetingData = (): { greeting: string; actions?: AskGeminiAction[] } => {
    if (mode === 'homepage') {
      return {
        greeting: `👋 **Hello! Welcome to SwiftStream Fiber Internet!**\n\nI am your **AI Fiber Consultant & Billing Assistant**. We deliver blazing-fast, unlimited pure fiber internet across **Lagonoy** and **Presentacion**, Camarines Sur.\n\nAsk me anything about our fiber plans, pricing, barangay coverage, how to sign up (zero requirements!), or **check your live billing statement and outstanding balance** by providing your Account Number!`,
        actions: [
          { label: '💳 Check My Bill / Balance', action: 'query', payload: { query: 'Check my billing balance' } },
          { label: '⚡ View All Plans', action: 'scroll', payload: { sectionId: 'plans' } },
          { label: '📍 Check Coverage', action: 'scroll', payload: { sectionId: 'coverage' } },
          { label: '📝 Sign Up Online', action: 'apply' },
        ],
      };
    }
    if (mode === 'client') {
      const name = activeCustomer ? activeCustomer.fullName.split(' ')[0] : 'Subscriber';
      const balStr = activeCustomer ? ` Your current balance is **₱${activeCustomer.balance.toLocaleString()}**.` : '';
      return {
        greeting: `👋 **Hello ${name}!**\n\nI am your **24/7 SwiftStream Client Care AI**.${balStr} I can help you check billing statements, guide you through GCash/Maya/Xendit payments, display your PPPoE credentials, or troubleshoot optical issues.`,
        actions: [
          { label: '💰 Check Balance', action: 'query', payload: { query: 'How much is my current balance?' } },
          { label: '📱 Pay via GCash / Maya', action: 'query', payload: { query: 'How do I pay my bill using GCash or Maya?' } },
          { label: '🔴 Fix Red LOS Light', action: 'query', payload: { query: 'My router has a red LOS light, what should I do?' } },
          { label: '📶 PPPoE Account Info', action: 'query', payload: { query: 'What is my PPPoE username and account status?' } },
        ],
      };
    }
    const overdueCount = customers.filter((c) => c.balance > 0).length;
    return {
      greeting: `👋 **Welcome, Administrator!**\n\n**SwiftStream ISP Copilot** is online with live operational awareness:\n- **Subscribers:** ${customers.length} registered (${overdueCount} with balances)\n- **MikroTik Routers:** ${mikrotikDevices.length} monitored\n- **Fiber NAP Boxes:** ${napBoxes.length} mapped in Lagonoy & Presentacion\n- **Operational Bills:** Ready to track DIA, CASURECO power, and pole rentals.\n\nHow can I assist your network and billing operations today?`,
      actions: [
        { label: '📅 Bill Due Calendar', action: 'tab', payload: { tabId: 'bill_calendar' } },
        { label: '👥 Subscribers CRM', action: 'tab', payload: { tabId: 'customers' } },
        { label: '📡 MikroTik Router Fleet', action: 'tab', payload: { tabId: 'mikrotik' } },
        { label: '📊 Financial Reports', action: 'tab', payload: { tabId: 'reports' } },
      ],
    };
  };

  const initialData = getInitialGreetingData();

  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'msg-init',
      role: 'assistant',
      content: initialData.greeting,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedActions: initialData.actions,
    },
  ]);

  // Update greeting if active customer changes in client mode
  useEffect(() => {
    if (mode === 'client' && messages.length === 1) {
      const init = getInitialGreetingData();
      setMessages([
        {
          id: 'msg-init',
          role: 'assistant',
          content: init.greeting,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedActions: init.actions,
        },
      ]);
    }
  }, [activeCustomer?.id, mode]);

  useEffect(() => {
    if (isOpen && !showSettings) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages, showSettings]);

  const quickPromptSuggestions: Record<'homepage' | 'client' | 'admin', string[]> = {
    homepage: [
      '💳 Check My Bill / Balance',
      '⚡ Fiber Plans & Pricing',
      '📍 Check Coverage in Lagonoy & Presentacion',
      '📝 How to Sign Up (No Requirements)',
      '📱 How to Pay via GCash / Maya',
      '🚀 Fiber Speed Matcher',
    ],
    client: [
      '💰 How much is my balance?',
      '📱 How to pay via GCash / Maya?',
      '🔴 Red LOS light on my router?',
      '📶 What is my PPPoE account?',
      '⚡ Can I upgrade my speed?',
    ],
    admin: [
      '📅 Upcoming Operational Bills (DIA, Power, Rent)',
      '📊 ISP KPI & Financial Snapshot',
      '⚠️ Overdue Subscribers List',
      '🛡️ MikroTik Walled Garden Script',
      '🔌 Fiber NAP Box Port Saturation',
      '📋 Invoices & Receivables',
    ],
  };

  const handleActionClick = (action: { label: string; action: string; payload?: any }) => {
    if (action.action === 'apply') {
      if (onOpenSignUp) {
        onOpenSignUp(action.payload?.planId, action.payload?.barangay, action.payload?.municipality);
      } else {
        setActiveTab('plans');
      }
    } else if (action.action === 'scroll') {
      const el = document.getElementById(action.payload?.sectionId || '');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (action.action === 'tab') {
      if (action.payload?.tabId) {
        setActiveTab(action.payload.tabId);
      }
    } else if (action.action === 'query') {
      handleSendMessage(action.payload?.query || action.label);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    const userMessage: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Map history for Gemini
      const historyForGemini: GeminiAiMessage[] = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const aiResult = await askGeminiAiAssistant({
        prompt: query,
        history: historyForGemini,
        mode,
        customer: activeCustomer,
        ispContext: {
          businessProfile,
          plans,
          customers,
          invoices,
          repairOrders,
          mikrotikDevices,
          napBoxes,
          expenses,
          operationalBills,
          coverageAreas,
        },
        apiKey: businessProfile.apiKeys.geminiApiKey,
        model: businessProfile.apiKeys.geminiModel,
      });

      const assistantMessage: AiChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: aiResult.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: aiResult.suggestedActions,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      if (!isOpen) {
        setHasUnread(true);
      }
    } catch (err) {
      console.error('Error asking Gemini:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content:
            'Sorry, I encountered an issue generating a response. Please check your internet connection or API settings.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    const init = getInitialGreetingData();
    setMessages([
      {
        id: `msg-init-${Date.now()}`,
        role: 'assistant',
        content: init.greeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: init.actions,
      },
    ]);
  };

  // Test API Key Connection
  const handleTestConnection = async () => {
    if (!tempApiKey.trim()) {
      setTestFeedback({ success: false, message: 'Please enter a valid Google Gemini API Key first.' });
      return;
    }
    setIsTestingKey(true);
    setTestFeedback(null);
    try {
      const res = await testGeminiApiKey(tempApiKey.trim(), selectedModel);
      setTestFeedback(res);
    } catch (e: any) {
      setTestFeedback({ success: false, message: e?.message || 'Connection test failed.' });
    } finally {
      setIsTestingKey(false);
    }
  };

  // Save Settings to Business Profile
  const handleSaveSettings = () => {
    updateBusinessProfile({
      apiKeys: {
        ...businessProfile.apiKeys,
        geminiApiKey: tempApiKey.trim(),
        geminiModel: selectedModel,
      },
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setShowSettings(false);
    }, 1500);
  };

  // Custom Markdown text and block renderer
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // 1. Code Block Fence (```)
      if (line.trim().startsWith('```')) {
        const lang = line.trim().replace(/^```/, '').trim();
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        elements.push(
          <div
            key={`code-${i}`}
            className="my-2 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-inner text-left"
          >
            {lang && (
              <div className="px-3 py-1 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-[10px] font-mono text-cyan-400">
                <span>{lang}</span>
              </div>
            )}
            <pre className="p-3 overflow-x-auto font-mono text-[11px] leading-relaxed text-cyan-300">
              <code>{codeLines.join('\n')}</code>
            </pre>
          </div>
        );
        continue;
      }

      // 2. Markdown Table Detection
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i]);
          i++;
        }

        if (tableLines.length >= 2) {
          const parseRow = (rowStr: string) =>
            rowStr
              .trim()
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim());

          const isSeparator = (rowStr: string) => /^\|(\s*[-:]+[-|\s:]*)\|$/.test(rowStr.trim());

          const rawHeaders = parseRow(tableLines[0]);
          let dataStartIndex = 1;
          if (tableLines.length > 1 && isSeparator(tableLines[1])) {
            dataStartIndex = 2;
          }

          const dataRows = tableLines.slice(dataStartIndex).map(parseRow);

          elements.push(
            <div
              key={`table-${i}`}
              className="my-2.5 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 shadow-inner"
            >
              <table className="min-w-full divide-y divide-slate-800 text-[11px] text-left">
                <thead>
                  <tr className="bg-slate-900/90 text-cyan-300 font-bold">
                    {rawHeaders.map((h, hIdx) => (
                      <th key={hIdx} className="px-2.5 py-1.5 text-slate-200">
                        {formatBoldAndCode(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {dataRows.map((row, rIdx) => (
                    <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-slate-950/40' : 'bg-slate-900/30'}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-2.5 py-1.5 text-slate-200 whitespace-nowrap">
                          {formatBoldAndCode(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // 3. Headers
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={`h4-${i}`} className="font-extrabold text-sm text-cyan-300 mt-2.5 mb-1 flex items-center gap-1.5">
            {formatBoldAndCode(line.replace('### ', ''))}
          </h4>
        );
        i++;
        continue;
      }
      if (line.startsWith('## ')) {
        elements.push(
          <h3 key={`h3-${i}`} className="font-black text-base text-slate-100 mt-3 mb-1">
            {formatBoldAndCode(line.replace('## ', ''))}
          </h3>
        );
        i++;
        continue;
      }
      if (line.startsWith('# ')) {
        elements.push(
          <h2 key={`h2-${i}`} className="font-black text-lg text-white mt-3 mb-1">
            {formatBoldAndCode(line.replace('# ', ''))}
          </h2>
        );
        i++;
        continue;
      }

      // 4. Blockquotes
      if (line.startsWith('> ')) {
        elements.push(
          <blockquote
            key={`bq-${i}`}
            className="my-1.5 pl-3 border-l-2 border-cyan-500/60 text-slate-300 italic text-[11px] bg-cyan-950/10 py-1 rounded-r"
          >
            {formatBoldAndCode(line.replace('> ', ''))}
          </blockquote>
        );
        i++;
        continue;
      }

      // 5. Unordered List Items
      if (line.startsWith('* ') || line.startsWith('- ')) {
        const itemText = line.replace(/^[\*\-]\s+/, '');
        elements.push(
          <li key={`li-${i}`} className="ml-4 list-disc text-slate-200 my-0.5">
            {formatBoldAndCode(itemText)}
          </li>
        );
        i++;
        continue;
      }

      // 6. Numbered Lists
      if (/^\d+\.\s+/.test(line)) {
        const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          elements.push(
            <div key={`oli-${i}`} className="flex items-start gap-1.5 ml-1 my-0.5 text-slate-200">
              <span className="font-mono text-cyan-400 font-bold min-w-[16px]">{numMatch[1]}.</span>
              <span>{formatBoldAndCode(numMatch[2])}</span>
            </div>
          );
          i++;
          continue;
        }
      }

      // 7. Empty line spacer
      if (line.trim() === '') {
        elements.push(<div key={`sp-${i}`} className="h-1.5" />);
        i++;
        continue;
      }

      // 8. Regular paragraph line
      elements.push(
        <p key={`p-${i}`} className="text-slate-200 leading-relaxed my-0.5">
          {formatBoldAndCode(line)}
        </p>
      );
      i++;
    }

    return elements;
  };

  const formatBoldAndCode = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\`.*?\`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-bold text-slate-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded font-mono text-[11px] text-cyan-300"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <>
      {/* 1. FLOATING ACTION PILL BUTTON */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-full shadow-2xl shadow-cyan-600/40 border border-cyan-400/40 transition-all hover:scale-105 active:scale-95 group animate-in fade-in slide-in-from-bottom-5"
          title="Open SwiftStream Gemini AI Assistant"
        >
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-cyan-200 animate-pulse" />
            </div>
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full ring-2 ring-slate-950 animate-ping" />
            )}
          </div>

          <div className="text-left hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black tracking-wide">
                {mode === 'homepage'
                  ? 'Ask SwiftStream AI'
                  : mode === 'client'
                  ? 'Client Care AI'
                  : 'ISP Copilot'}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-400/30">
                Gemini
              </span>
            </div>
            <span className="text-[10px] text-cyan-100/80 block">
              {mode === 'homepage'
                ? 'Plans, Pricing & Coverage'
                : mode === 'client'
                ? '24/7 Billing & Tech Help'
                : 'Operations & Network Assistant'}
            </span>
          </div>
        </button>
      )}

      {/* 2. EXPANDABLE CHAT MODAL WINDOW */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 flex flex-col shadow-2xl border border-slate-800 bg-slate-950/95 backdrop-blur-xl ${
            isMinimized
              ? 'bottom-6 right-6 w-80 h-14 rounded-2xl overflow-hidden'
              : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[94vw] sm:w-[460px] h-[610px] max-h-[88vh] rounded-3xl overflow-hidden'
          }`}
        >
          {/* Header Bar */}
          <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between select-none">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/30">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-sm text-slate-100">
                    {mode === 'homepage'
                      ? 'SwiftStream AI Assistant'
                      : mode === 'client'
                      ? 'Client Support AI'
                      : 'SwiftStream ISP Copilot'}
                  </h3>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold border ${
                      mode === 'admin'
                        ? businessProfile.apiKeys.geminiApiKey
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                          : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    }`}
                  >
                    {mode === 'admin'
                      ? businessProfile.apiKeys.geminiApiKey
                        ? 'Gemini Live'
                        : 'Smart Local'
                      : '24/7 Online'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {mode === 'homepage'
                    ? 'SwiftStream Sales & Coverage AI'
                    : mode === 'client'
                    ? '24/7 Subscriber Care & Billing Help'
                    : businessProfile.apiKeys.geminiApiKey
                    ? `Powered by Google ${businessProfile.apiKeys.geminiModel || 'gemini-2.5-flash'}`
                    : 'SwiftStream Intelligent Domain Engine'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Only show Settings drawer in Admin mode */}
              {mode === 'admin' && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    showSettings
                      ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                  title="Gemini AI & Model Settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={handleResetChat}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                title="Reset Conversation"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowSettings(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* SETTINGS DRAWER OVERLAY (ADMIN ONLY) */}
              {mode === 'admin' && showSettings ? (
                <div className="flex-1 p-4 overflow-y-auto bg-slate-950 space-y-4 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-cyan-400" />
                      <h4 className="font-extrabold text-sm text-slate-100">AI Engine & Model Configuration</h4>
                    </div>
                    <button
                      onClick={() => setShowSettings(false)}
                      className="text-slate-400 hover:text-slate-200 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Active Status Badge */}
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        businessProfile.apiKeys.geminiApiKey
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {businessProfile.apiKeys.geminiApiKey ? (
                        <Sparkles className="w-4 h-4" />
                      ) : (
                        <ShieldCheck className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-slate-200 flex items-center gap-1.5">
                        <span>
                          {businessProfile.apiKeys.geminiApiKey
                            ? 'Google Gemini Cloud Active'
                            : 'Smart Local Domain Engine Active'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                        {businessProfile.apiKeys.geminiApiKey
                          ? `Queries are processed via live Google Gemini multimodal reasoning (${businessProfile.apiKeys.geminiModel || 'gemini-2.5-flash'}).`
                          : 'Operating offline with complete domain intelligence of Lagonoy & Presentacion plans, coverage, router configurations, and operational bills.'}
                      </p>
                    </div>
                  </div>

                  {/* API Key Input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                      <span>Google Gemini API Key</span>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-cyan-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Get Free Key</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </label>

                    <div className="relative">
                      <input
                        type={showKeyPlaintext ? 'text' : 'password'}
                        value={tempApiKey}
                        onChange={(e) => setTempApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full pl-3 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeyPlaintext(!showKeyPlaintext)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {showKeyPlaintext ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Leave blank to use the built-in Smart Local Domain Knowledge Engine.
                    </p>
                  </div>

                  {/* Model Selection */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Gemini Model</span>
                    </label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                    >
                      <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended - Fast & Reasoning)</option>
                      <option value="gemini-2.0-flash">gemini-2.0-flash (High Performance)</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash (Legacy Lightweight)</option>
                    </select>
                  </div>

                  {/* Test Feedback Banner */}
                  {testFeedback && (
                    <div
                      className={`p-2.5 rounded-xl text-[11px] flex items-start gap-2 border ${
                        testFeedback.success
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      {testFeedback.success ? (
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                      )}
                      <span>{testFeedback.message}</span>
                    </div>
                  )}

                  {saveSuccess && (
                    <div className="p-2.5 rounded-xl text-[11px] flex items-center gap-2 border bg-emerald-950/40 border-emerald-500/40 text-emerald-300">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>Settings saved to business profile!</span>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTestingKey || !tempApiKey.trim()}
                      className="flex-1 py-2 px-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {isTestingKey ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Test Connection</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveSettings}
                      className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-600/20 transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Config</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-slate-900 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSettings(false);
                        setActiveTab('settings');
                      }}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1.5 transition-colors"
                    >
                      <Settings className="w-3 h-3" />
                      <span>Open Full Admin Settings</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Message Feed Area */}
                  <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
                    {messages.map((msg) => {
                      const isAssistant = msg.role === 'assistant';
                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-2.5 ${isAssistant ? 'items-start' : 'items-end justify-end'}`}
                        >
                          {isAssistant && (
                            <div className="w-7 h-7 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Bot className="w-4 h-4" />
                            </div>
                          )}

                          <div
                            className={`p-3.5 rounded-2xl max-w-[88%] relative group ${
                              isAssistant
                                ? 'bg-slate-900 border border-slate-800/90 text-slate-200 shadow-sm'
                                : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none shadow-md shadow-cyan-600/20'
                            }`}
                          >
                            <div className="text-[12px]">{renderFormattedContent(msg.content)}</div>

                            {/* Suggested Action Chips */}
                            {isAssistant && msg.suggestedActions && msg.suggestedActions.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-slate-800/80">
                                {msg.suggestedActions.map((act, actIdx) => (
                                  <button
                                    key={actIdx}
                                    onClick={() => handleActionClick(act)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-gradient-to-r from-cyan-950 to-blue-950 hover:from-cyan-900 hover:to-blue-900 border border-cyan-500/40 text-cyan-300 hover:text-white shadow-sm transition-all hover:scale-105 active:scale-95"
                                  >
                                    <Zap className="w-3 h-3 text-cyan-400" />
                                    <span>{act.label}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            <div
                              className={`flex items-center justify-between gap-2 mt-2 pt-1 border-t text-[10px] ${
                                isAssistant
                                  ? 'border-slate-800/80 text-slate-500'
                                  : 'border-cyan-500/30 text-cyan-100/70'
                              }`}
                            >
                              <span>{msg.timestamp}</span>
                              {isAssistant && (
                                <button
                                  onClick={() => handleCopy(msg.content, msg.id)}
                                  className="opacity-0 group-hover:opacity-100 hover:text-slate-200 flex items-center gap-1 transition-opacity"
                                  title="Copy text"
                                >
                                  {copiedId === msg.id ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                  <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {!isAssistant && (
                            <div className="w-7 h-7 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center flex-shrink-0 mb-0.5">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {isLoading && (
                      <div className="flex items-center gap-2 text-slate-400 p-2 text-xs">
                        <div className="w-6 h-6 rounded-lg bg-cyan-600/20 text-cyan-400 flex items-center justify-center animate-pulse">
                          <Sparkles className="w-3.5 h-3.5 animate-spin" />
                        </div>
                        <span>SwiftStream Gemini is thinking...</span>
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* Quick Prompt Chips */}
                  <div className="px-4 py-2 border-t border-slate-900 bg-slate-950/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {quickPromptSuggestions[mode].map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(chip)}
                        disabled={isLoading}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-300 text-[11px] whitespace-nowrap transition-colors flex-shrink-0"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>

                  {/* Input Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
                  >
                    <input
                      ref={inputRef}
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={
                        mode === 'homepage'
                          ? 'Ask about fiber plans, check your bill balance, coverage...'
                          : mode === 'client'
                          ? 'Ask about your balance, GCash payment, WiFi troubleshooting...'
                          : 'Ask for ISP metrics, upcoming bills, RouterOS scripts...'
                      }
                      disabled={isLoading}
                      className="flex-1 px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 transition-all"
                    />

                    <button
                      type="submit"
                      disabled={!inputMessage.trim() || isLoading}
                      className="p-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 text-white rounded-xl shadow-lg shadow-cyan-600/20 transition-all hover:scale-105 active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
};

