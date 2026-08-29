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
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Customer, AiChatMessage } from '../../types';
import { askGeminiAiAssistant, GeminiAiMessage } from '../../utils/geminiService';

interface GeminiAiAssistantProps {
  mode: 'homepage' | 'client' | 'admin';
  activeCustomer?: Customer | null;
}

export const GeminiAiAssistant: React.FC<GeminiAiAssistantProps> = ({ mode, activeCustomer }) => {
  const {
    businessProfile,
    plans,
    customers,
    invoices,
    repairOrders,
    mikrotikDevices,
    napBoxes,
    expenses,
  } = useApp();

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasUnread, setHasUnread] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Determine initial greeting based on mode
  const getInitialGreeting = (): string => {
    if (mode === 'homepage') {
      return `👋 **Hello! Welcome to SwiftStream Telecommunication & Repair Shop!**\n\nI am your **AI Fiber Sales Consultant**. Looking for ultra-fast, unlimited fiber internet in Lagonoy, or electronics repair services? Ask me anything about our plans, pricing, installation, or coverage!`;
    }
    if (mode === 'client') {
      const name = activeCustomer ? activeCustomer.fullName.split(' ')[0] : 'Subscriber';
      const balStr = activeCustomer ? ` Your current balance is **₱${activeCustomer.balance.toLocaleString()}**.` : '';
      return `👋 **Hello ${name}!**\n\nI am your **24/7 SwiftStream Client Care AI**.${balStr} I can help you check billing statements, guide you through GCash/Maya/Xendit payments, display your PPPoE credentials, or troubleshoot your optical connection.`;
    }
    return `👋 **Welcome, Administrator!**\n\n**SwiftStream ISP Copilot** is online. I have live awareness of all **${customers.length} subscribers**, billing collection status, MikroTik router fleet, and fiber NAP boxes. How can I assist your operations today?`;
  };

  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: 'msg-init',
      role: 'assistant',
      content: getInitialGreeting(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Update greeting if active customer changes in client mode
  useEffect(() => {
    if (mode === 'client' && messages.length === 1) {
      setMessages([
        {
          id: 'msg-init',
          role: 'assistant',
          content: getInitialGreeting(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [activeCustomer?.id, mode]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const quickPromptSuggestions: Record<'homepage' | 'client' | 'admin', string[]> = {
    homepage: [
      '⚡ What is the fastest fiber plan?',
      '💳 How do I pay via GCash?',
      '📍 Is Barangay Binauahan covered?',
      '🔧 Laptop & phone repair warranty?',
    ],
    client: [
      '💰 How much is my balance?',
      '📱 How to pay via GCash / Maya?',
      '🔴 Red LOS light on my router?',
      '📶 What is my PPPoE account?',
    ],
    admin: [
      '📊 Give me an ISP KPI summary',
      '⚠️ How many users are overdue?',
      '🛡️ MikroTik Walled Garden script',
      '🔌 Show Fiber NAP port usage',
    ],
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

      const aiResponseText = await askGeminiAiAssistant({
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
        },
        apiKey: businessProfile.apiKeys.geminiApiKey,
        model: businessProfile.apiKeys.geminiModel,
      });

      const assistantMessage: AiChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: aiResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
          content: 'Sorry, I encountered an issue generating a response. Please check your internet connection or API settings.',
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
    setMessages([
      {
        id: `msg-init-${Date.now()}`,
        role: 'assistant',
        content: getInitialGreeting(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Simple custom Markdown text renderer
  const renderFormattedContent = (content: string) => {
    return content.split('\n').map((line, idx) => {
      // Headers
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="font-extrabold text-sm text-cyan-300 mt-2 mb-1">
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h3 key={idx} className="font-black text-base text-slate-100 mt-2.5 mb-1">
            {line.replace('## ', '')}
          </h3>
        );
      }
      if (line.startsWith('* ') || line.startsWith('- ')) {
        const itemText = line.replace(/^[\*\-]\s+/, '');
        return (
          <li key={idx} className="ml-4 list-disc text-slate-200 my-0.5">
            {formatBoldAndCode(itemText)}
          </li>
        );
      }
      if (line.trim() === '') {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className="text-slate-200 leading-relaxed my-0.5">
          {formatBoldAndCode(line)}
        </p>
      );
    });
  };

  const formatBoldAndCode = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\`.*?\`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-slate-100">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded font-mono text-[11px] text-cyan-300">
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
                {mode === 'homepage' ? 'Ask SwiftStream AI' : mode === 'client' ? 'Client Care AI' : 'ISP Copilot'}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-cyan-950/80 text-cyan-300 border border-cyan-400/30">
                Gemini
              </span>
            </div>
            <span className="text-[10px] text-cyan-100/80 block">
              {mode === 'homepage' ? 'Plans, Pricing & Coverage' : mode === 'client' ? '24/7 Billing & Tech Help' : 'Operations & Network Assistant'}
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
              : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[94vw] sm:w-[440px] h-[580px] max-h-[88vh] rounded-3xl overflow-hidden'
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
                    {mode === 'homepage' ? 'SwiftStream AI Assistant' : mode === 'client' ? 'Client Support AI' : 'SwiftStream ISP Copilot'}
                  </h3>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold border ${
                    businessProfile.apiKeys.geminiApiKey
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  }`}>
                    {businessProfile.apiKeys.geminiApiKey ? 'Gemini Live' : 'Smart Local'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">
                  {businessProfile.apiKeys.geminiApiKey
                    ? `Powered by Google ${businessProfile.apiKeys.geminiModel || 'gemini-2.5-flash'}`
                    : 'SwiftStream Intelligent Domain Engine'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
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
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
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
                        className={`p-3.5 rounded-2xl max-w-[85%] relative group ${
                          isAssistant
                            ? 'bg-slate-900 border border-slate-800/90 text-slate-200 shadow-sm'
                            : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none shadow-md shadow-cyan-600/20'
                        }`}
                      >
                        <div className="text-[12px]">{renderFormattedContent(msg.content)}</div>

                        <div
                          className={`flex items-center justify-between gap-2 mt-2 pt-1 border-t text-[10px] ${
                            isAssistant ? 'border-slate-800/80 text-slate-500' : 'border-cyan-500/30 text-cyan-100/70'
                          }`}
                        >
                          <span>{msg.timestamp}</span>
                          {isAssistant && (
                            <button
                              onClick={() => handleCopy(msg.content, msg.id)}
                              className="opacity-0 group-hover:opacity-100 hover:text-slate-200 flex items-center gap-1 transition-opacity"
                              title="Copy text"
                            >
                              {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
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
                  placeholder="Ask about plans, bills, WiFi, repairs, or router..."
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
        </div>
      )}
    </>
  );
};

