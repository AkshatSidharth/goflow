import React, { useRef, useEffect, useCallback, useState } from 'react';

/** Sample prompts organized by language/category */
const SAMPLE_PROMPTS = [
  {
    category: 'English',
    flag: '🇬🇧',
    prompts: [
      'User logs in. If credentials are valid, show dashboard. Otherwise, show error and let them retry.',
      'Customer places an order. Check inventory. If in stock, process payment. If payment succeeds, ship order. Otherwise show error.',
      'Employee submits leave request. Manager reviews. If approved, update calendar and notify employee. If rejected, notify with reason.',
    ],
  },
  {
    category: 'Hindi',
    flag: '🇮🇳',
    prompts: [
      'उपयोगकर्ता फॉर्म भरता है। अगर फॉर्म सही है तो सबमिट करें, वरना त्रुटि दिखाएं।',
      'ग्राहक उत्पाद खोजता है। अगर उत्पाद मिलता है तो कार्ट में जोड़ें, नहीं तो "नहीं मिला" दिखाएं।',
    ],
  },
  {
    category: 'Japanese',
    flag: '🇯🇵',
    prompts: [
      'ユーザーがログインします。もし認証情報が正しければ、ダッシュボードを表示します。そうでなければ、エラーを表示して再試行します。',
    ],
  },
  {
    category: 'Chinese',
    flag: '🇨🇳',
    prompts: [
      '用户提交申请。如果申请有效，则处理申请。否则，显示错误并要求用户重新填写。',
    ],
  },
];

/** Formats a timestamp to HH:MM */
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Individual chat message bubble.
 */
function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isError = message.type === 'error';
  const isSystem = message.type === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-gray-500 text-xs bg-gray-800/60 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-2.5 animate-fade-in ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`
          flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5
          ${isUser ? 'bg-indigo-600 text-white' : isError ? 'bg-red-900 text-red-300' : 'bg-gray-700 text-gray-300'}
        `}
      >
        {isUser ? 'U' : isError ? '!' : 'AI'}
      </div>

      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Message bubble */}
        <div
          className={`
            px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
            ${isUser
              ? 'message-user text-white rounded-tr-sm'
              : isError
              ? 'message-error text-red-200 rounded-tl-sm'
              : 'message-assistant text-gray-200 rounded-tl-sm'}
          `}
        >
          {isError && (
            <div className="flex items-center gap-1.5 mb-1.5 text-red-400 font-medium text-xs">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              Error
            </div>
          )}
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        {/* Timestamp */}
        {message.timestamp && (
          <span className="text-gray-600 text-[10px] px-1">
            {formatTime(message.timestamp)}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Loading indicator shown while AI is processing.
 */
function LoadingBubble() {
  return (
    <div className="flex gap-2.5 animate-fade-in">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 mt-0.5">
        AI
      </div>
      <div className="message-assistant px-4 py-3 rounded-2xl rounded-tl-sm">
        <div className="flex items-center gap-1.5">
          <span className="loading-dot w-2 h-2 rounded-full bg-indigo-400 inline-block" />
          <span className="loading-dot w-2 h-2 rounded-full bg-indigo-400 inline-block" />
          <span className="loading-dot w-2 h-2 rounded-full bg-indigo-400 inline-block" />
          <span className="text-gray-500 text-xs ml-1">Generating flowchart…</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Sample prompts section shown when chat is empty.
 */
function SamplePrompts({ onSelect }) {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="space-y-3 p-4">
      <div className="text-center">
        <h2 className="text-gray-300 font-semibold text-sm mb-0.5">
          Try a sample prompt
        </h2>
        <p className="text-gray-500 text-xs">
          Click to use, or type your own below
        </p>
      </div>

      {/* Language tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {SAMPLE_PROMPTS.map((cat, idx) => (
          <button
            key={cat.category}
            onClick={() => setActiveCategory(idx)}
            className={`
              flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
              transition-all duration-150
              ${activeCategory === idx
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'}
            `}
          >
            <span>{cat.flag}</span>
            <span>{cat.category}</span>
          </button>
        ))}
      </div>

      {/* Prompts for active category */}
      <div className="space-y-2">
        {SAMPLE_PROMPTS[activeCategory].prompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(prompt)}
            className="
              w-full text-left text-xs text-gray-400 bg-gray-800/70 hover:bg-gray-700/80
              border border-gray-700 hover:border-indigo-600/50
              rounded-lg px-3 py-2.5
              transition-all duration-150
              leading-relaxed
              line-clamp-3
            "
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Main ChatPanel component.
 */
export default function ChatPanel({ messages, onSend, isLoading, hasFlowchart }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isLoading, onSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleSampleSelect = useCallback((prompt) => {
    setInput(prompt);
    textareaRef.current?.focus();
  }, []);

  const handleTextareaInput = useCallback((e) => {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">FlowMind</h1>
            <p className="text-gray-500 text-[10px] leading-tight">AI Flowchart Generator</p>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          <span className="text-gray-500 text-[10px]">
            {isLoading ? 'Generating…' : 'Ready'}
          </span>
        </div>
      </div>

      {/* ─── Messages area ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <SamplePrompts onSelect={handleSampleSelect} />
        ) : (
          <div className="px-4 py-4 space-y-4">
            {messages.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} />
            ))}
            {isLoading && <LoadingBubble />}
            <div ref={messagesEndRef} />
          </div>
        )}

        {hasMessages && (
          <div className="px-4 py-2">
            {isLoading && (
              <div className="space-y-4">
                <LoadingBubble />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ─── Hint when flowchart exists ──────────────────────────────────── */}
      {hasFlowchart && !isLoading && (
        <div className="flex-shrink-0 mx-4 mb-2">
          <div className="bg-indigo-950/60 border border-indigo-800/40 rounded-lg px-3 py-2 text-xs text-indigo-300/80 flex items-center gap-2">
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
            You can modify the flowchart — just describe your changes
          </div>
        </div>
      )}

      {/* ─── Input area ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-gray-800 px-4 py-3">
        <div className={`
          flex items-end gap-2 bg-gray-800 border rounded-xl px-3 py-2
          transition-all duration-150
          ${isLoading ? 'border-gray-700 opacity-60' : 'border-gray-700 focus-within:border-indigo-600 focus-within:shadow-lg focus-within:shadow-indigo-900/20'}
        `}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
            placeholder={
              hasFlowchart
                ? 'Describe changes to your flowchart…'
                : 'Describe a process or workflow…'
            }
            className="
              flex-1 bg-transparent text-gray-200 text-sm
              placeholder-gray-600
              resize-none outline-none border-none
              leading-relaxed py-1
              disabled:cursor-not-allowed
            "
            style={{ minHeight: '36px', maxHeight: '150px' }}
          />

          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="
              flex-shrink-0 mb-0.5
              w-8 h-8 rounded-lg
              flex items-center justify-center
              bg-indigo-600 hover:bg-indigo-500
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-150
              shadow-sm
            "
            aria-label="Send message"
          >
            {isLoading ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>

        <p className="text-gray-600 text-[10px] text-center mt-2">
          Enter to send • Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
