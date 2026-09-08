import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  MessageSquare,
  Wrench,
  User,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Check,
  ShieldAlert,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { RepairOrder, RepairStatus, TicketMessage } from '../../types';
import { getRepairStatusBadge, generateId, formatDateTime, formatPhoneNumber } from '../../utils/formatters';

interface TicketChatModalProps {
  ticket: RepairOrder;
  currentRole: 'customer' | 'technician' | 'admin';
  currentUserName: string;
  currentUserId?: string;
  onClose: () => void;
  onUpdateTicket: (ticketId: string, updates: Partial<RepairOrder>) => void;
}

export const TicketChatModal: React.FC<TicketChatModalProps> = ({
  ticket,
  currentRole,
  currentUserName,
  currentUserId,
  onClose,
  onUpdateTicket,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fallback initial message from original ticket issue if messages array is empty
  const initialMessages: TicketMessage[] = ticket.messages && ticket.messages.length > 0
    ? ticket.messages
    : [
        {
          id: `init-${ticket.id}`,
          senderId: ticket.customerId,
          senderName: ticket.customerName,
          senderRole: 'customer',
          message: ticket.issueDescription,
          timestamp: ticket.createdAt || new Date().toISOString(),
        },
      ];

  const [messageList, setMessageList] = useState<TicketMessage[]>(initialMessages);

  // Keep local messages in sync with parent ticket updates (real-time listener)
  useEffect(() => {
    if (ticket.messages && ticket.messages.length > 0) {
      setMessageList(ticket.messages);
    }
  }, [ticket.messages]);

  // Auto-scroll to bottom on message list change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageList]);

  // Send a new message
  const handleSendMessage = (textToSend?: string) => {
    const content = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!content) return;

    setIsSending(true);

    const newMessage: TicketMessage = {
      id: generateId('MSG'),
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentRole,
      message: content,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messageList, newMessage];
    setMessageList(updatedMessages);
    if (!textToSend) setInputText('');

    onUpdateTicket(ticket.id, {
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    });

    setIsSending(false);
  };

  // Status Change Handler
  const handleStatusChange = (newStatus: RepairStatus) => {
    const statusNote =
      newStatus === 'in_progress'
        ? `Field technician status updated to: In Progress / Dispatched.`
        : newStatus === 'resolved'
        ? `Ticket marked as RESOLVED by ${currentUserName}. Service line restored.`
        : newStatus === 'closed'
        ? `Ticket officially CLOSED.`
        : `Ticket status set to: ${newStatus}.`;

    const systemMsg: TicketMessage = {
      id: generateId('SYS'),
      senderName: 'System Dispatch',
      senderRole: 'system',
      message: statusNote,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messageList, systemMsg];
    setMessageList(updatedMessages);

    onUpdateTicket(ticket.id, {
      status: newStatus,
      dateCompleted: newStatus === 'resolved' || newStatus === 'closed' ? new Date().toISOString().slice(0, 10) : ticket.dateCompleted,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
    });
  };

  const badge = getRepairStatusBadge(ticket.status);

  // Quick reply options depending on role
  const quickReplies =
    currentRole === 'customer'
      ? [
          'LOS light is blinking red on modem',
          'Power adapter has no indicator light',
          'Drop cable appears physically cut or loose',
          'Internet connection restored, thank you!',
          'I am currently at home',
        ]
      : [
          'En route to your location now.',
          'Checking optical connection at the NAP box.',
          'Fiber splice complete. Please power-cycle your router.',
          'Optical link verified. Service is fully restored.',
          'Awaiting customer confirmation to close ticket.',
        ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl h-[92vh] max-h-[750px] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-sm text-cyan-300">{ticket.orderNumber}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${badge.bg} ${badge.textCol}`}>
                  {badge.text}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-medium">
                  {ticket.deviceType}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {ticket.customerName} • {ticket.address}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick Status Changer Dropdown */}
            <div className="relative inline-block">
              <select
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value as RepairStatus)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 hover:border-cyan-500 rounded-xl text-xs font-semibold text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="open">Status: Open</option>
                <option value="in_progress">Status: In Progress</option>
                <option value="resolved">Status: Resolved</option>
                <option value="closed">Status: Closed</option>
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
              title="Close chat window"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Customer & Ticket Quick Details Banner */}
        <div className="px-4 py-2.5 bg-slate-950/50 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <strong className="text-slate-200">{ticket.customerName}</strong>
            </span>
            {ticket.contactNumber && (
              <a
                href={`tel:${ticket.contactNumber}`}
                className="flex items-center gap-1 text-cyan-400 hover:underline"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{formatPhoneNumber(ticket.contactNumber)}</span>
              </a>
            )}
            <span className="flex items-center gap-1 text-slate-400">
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>Tech: <strong className="text-slate-200">{ticket.technician || 'Field Dispatch Team'}</strong></span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {ticket.status !== 'resolved' && (
              <button
                onClick={() => handleStatusChange('resolved')}
                className="px-2.5 py-1 rounded-lg bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/80 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3 h-3" />
                <span>Mark Resolved</span>
              </button>
            )}
            {ticket.status !== 'closed' && (
              <button
                onClick={() => handleStatusChange('closed')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Close Ticket</span>
              </button>
            )}
          </div>
        </div>

        {/* Chat Message Scrollable Container */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 text-xs bg-gradient-to-b from-slate-900 to-slate-950/70">
          {messageList.map((msg, idx) => {
            const isMe =
              (currentRole === 'customer' && msg.senderRole === 'customer') ||
              ((currentRole === 'technician' || currentRole === 'admin') &&
                (msg.senderRole === 'technician' || msg.senderRole === 'admin'));

            const isSystem = msg.senderRole === 'system';

            if (isSystem) {
              return (
                <div key={msg.id || idx} className="flex justify-center my-2 animate-in fade-in">
                  <div className="px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-slate-300 flex items-center gap-1.5 shadow-sm">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>{msg.message}</span>
                    <span className="text-[9px] text-slate-500">• {formatDateTime(msg.timestamp)}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-300">{msg.senderName}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                      msg.senderRole === 'customer'
                        ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/50'
                        : 'bg-purple-950 text-purple-300 border border-purple-800/50'
                    }`}
                  >
                    {msg.senderRole === 'customer' ? 'Subscriber' : 'Field Tech'}
                  </span>
                  <span className="text-slate-500">{formatDateTime(msg.timestamp)}</span>
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-md ${
                    isMe
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-800 border border-slate-700/80 text-slate-100 rounded-tl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] text-slate-500 font-bold shrink-0">Quick Reply:</span>
          {quickReplies.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(chip)}
              className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/60 hover:text-cyan-300 text-[11px] text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Message Composer Footer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              currentRole === 'customer'
                ? 'Type your message to the technician...'
                : 'Send update or instructions to the subscriber...'
            }
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 disabled:hover:from-cyan-600 disabled:hover:to-blue-600 text-white rounded-2xl font-bold flex items-center gap-1.5 transition-all text-xs cursor-pointer shadow-lg shadow-cyan-600/20"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};

