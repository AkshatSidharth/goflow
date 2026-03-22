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

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function PlanBubble({ message, showButtons, onConfirm, onCancel }) {
  return (
    <div className="flex gap-2.5 animate-fade-in">
      {/* Avatar */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-800/80 border border-indigo-600/60 flex items-center justify-center text-[10px] font-bold text-indigo-200 mt-0.5">
        AI
      </div>

      <div className="flex flex-col gap-2 max-w-[84%] items-start">
        {/* Plan card */}
        <div className="message-assistant px-3.5 py-3 rounded-2xl rounded-tl-sm text-sm text-gray-100 leading-relaxed">
          <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            Proposed Flowchart
          </p>
          <p className="whitespace-pre-wrap break-words text-gray-200">{message.content}</p>
        </div>

        {/* Action buttons — only on the active plan */}
        {showButtons && (
          <div className="flex gap-2">
            <button
              onClick={onConfirm}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm shadow-indigo-900/40"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Generate Flowchart
            </button>
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/80 hover:bg-gray-600/80 text-gray-300 text-xs font-medium rounded-xl border border-gray-600/60 transition-all"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
          </div>
        )}

        {message.timestamp && (
          <span className="text-gray-600 text-[10px] px-1">{formatTime(message.timestamp)}</span>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isError = message.type === 'error';
  const isSystem = message.type === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-1">
        <span className="text-gray-500 text-[11px] bg-gray-800/50 px-3 py-1 rounded-full border border-gray-700/50">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 animate-fade-in ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`
          flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5
          ${isUser
            ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-900/40'
            : isError
            ? 'bg-red-900/80 text-red-300 border border-red-700'
            : 'bg-gray-700/80 text-gray-300 border border-gray-600'}
        `}
      >
        {isUser ? 'U' : isError ? '!' : 'AI'}
      </div>

      <div className={`flex flex-col gap-1 max-w-[84%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`
            px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
            ${isUser
              ? 'message-user text-white rounded-tr-sm'
              : isError
              ? 'message-error text-red-200 rounded-tl-sm'
              : 'message-assistant text-gray-100 rounded-tl-sm'}
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
        {message.timestamp && (
          <span className="text-gray-600 text-[10px] px-1">{formatTime(message.timestamp)}</span>
        )}
      </div>
    </div>
  );
}

function LoadingBubble() {
  return (
    <div className="flex gap-2.5 animate-fade-in">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-700/80 border border-gray-600 flex items-center justify-center text-[10px] font-bold text-gray-300 mt-0.5">
        AI
      </div>
      <div className="message-assistant px-4 py-3 rounded-2xl rounded-tl-sm">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="loading-dot w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
            <span className="loading-dot w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
            <span className="loading-dot w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
          </div>
          <span className="text-gray-400 text-xs">Thinking…</span>
        </div>
      </div>
    </div>
  );
}

function SamplePrompts({ onSelect }) {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="flex flex-col h-full justify-center px-4 py-6 space-y-5">
      {/* Hero */}
      <div className="text-center space-y-1">
        <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/40 mb-3">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <h2 className="text-gray-200 font-semibold text-sm">Describe any process</h2>
        <p className="text-gray-500 text-xs leading-relaxed">
          Type in plain language — FlowMind will turn it into a flowchart
        </p>
      </div>

      {/* Language tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {SAMPLE_PROMPTS.map((cat, idx) => (
          <button
            key={cat.category}
            onClick={() => setActiveCategory(idx)}
            className={`
              flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium
              transition-all duration-150
              ${activeCategory === idx
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/50'
                : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700/80 hover:text-gray-300 border border-gray-700/60'}
            `}
          >
            <span>{cat.flag}</span>
            <span>{cat.category}</span>
          </button>
        ))}
      </div>

      {/* Prompts */}
      <div className="space-y-2">
        {SAMPLE_PROMPTS[activeCategory].prompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(prompt)}
            className="
              w-full text-left text-xs text-gray-400 bg-gray-800/50 hover:bg-gray-700/60
              border border-gray-700/60 hover:border-indigo-500/40
              rounded-xl px-3.5 py-2.5
              transition-all duration-150
              leading-relaxed line-clamp-3
            "
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ChatPanel({ messages, onSend, isLoading, hasFlowchart, hasPending, onConfirm, onCancel }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
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
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full" style={{ background: 'linear-gradient(180deg, #0f1117 0%, #111827 100%)' }}>
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-gray-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/50">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm leading-tight tracking-tight">FlowMind</h1>
            <p className="text-gray-500 text-[10px] leading-tight">AI Flowchart Generator</p>
          </div>
        </div>

        {/* Status pill */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all duration-300 ${
          isLoading
            ? 'bg-amber-950/50 border-amber-800/50 text-amber-400'
            : 'bg-emerald-950/50 border-emerald-800/50 text-emerald-400'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          {isLoading ? 'Thinking…' : 'Ready'}
        </div>
      </div>

      {/* ─── Messages area ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          <SamplePrompts onSelect={handleSampleSelect} />
        ) : (
          <div className="px-4 py-4 space-y-4">
            {messages.map((msg, idx) => {
              if (msg.type === 'plan') {
                // Only the last plan message gets active buttons when hasPending is true
                const isLastPlan = messages.findLastIndex((m) => m.type === 'plan') === idx;
                return (
                  <PlanBubble
                    key={idx}
                    message={msg}
                    showButtons={isLastPlan && hasPending}
                    onConfirm={onConfirm}
                    onCancel={onCancel}
                  />
                );
              }
              return <MessageBubble key={idx} message={msg} />;
            })}
            {isLoading && <LoadingBubble />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ─── Edit hint ──────────────────────────────────────────────────── */}
      {hasFlowchart && !isLoading && (
        <div className="flex-shrink-0 mx-4 mb-2">
          <div className="bg-indigo-950/40 border border-indigo-800/30 rounded-xl px-3 py-2 text-xs text-indigo-300/70 flex items-center gap-2">
            <svg className="w-3 h-3 flex-shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
            Describe changes to modify the flowchart
          </div>
        </div>
      )}

      {/* ─── Input area ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-gray-800/80 px-4 py-3.5">
        <div className={`
          flex items-end gap-2.5 rounded-2xl px-3.5 py-2.5 border transition-all duration-200
          ${isLoading
            ? 'bg-gray-800/40 border-gray-700/50 opacity-60'
            : 'bg-gray-800/60 border-gray-700/60 focus-within:border-indigo-500/60 focus-within:bg-gray-800/80 focus-within:shadow-lg focus-within:shadow-indigo-900/20'}
        `}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
            placeholder={hasFlowchart ? 'Describe changes to your flowchart…' : 'Describe a process or workflow…'}
            className="
              flex-1 bg-transparent text-gray-200 text-sm
              placeholder-gray-600
              resize-none outline-none border-none
              leading-relaxed py-0.5
              disabled:cursor-not-allowed
            "
            style={{ minHeight: '32px', maxHeight: '150px' }}
          />

          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            className="
              flex-shrink-0 mb-0.5
              w-8 h-8 rounded-xl
              flex items-center justify-center
              bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
              disabled:opacity-30 disabled:cursor-not-allowed
              transition-all duration-150
              shadow-sm shadow-indigo-900/50
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

        <p className="text-gray-700 text-[10px] text-center mt-2">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
