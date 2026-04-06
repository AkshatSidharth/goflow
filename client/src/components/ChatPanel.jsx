import React, { useRef, useEffect, useCallback, useState } from 'react';

// ─── Language config ──────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'EN', flag: '🇬🇧', name: 'English' },
  { code: 'HI', flag: '🇮🇳', name: 'Hindi' },
  { code: 'JA', flag: '🇯🇵', name: 'Japanese' },
  { code: 'ZH', flag: '🇨🇳', name: 'Chinese' },
];

const SAMPLE_PROMPTS = {
  EN: [
    'User logs in. If credentials are valid, show dashboard. Otherwise show error and retry.',
    'Customer places order. Check inventory. If in stock, process payment. If successful, ship order.',
    'Employee submits leave request. Manager reviews. If approved, update calendar and notify employee.',
  ],
  HI: [
    'उपयोगकर्ता फॉर्म भरता है। अगर सही है तो सबमिट करें, वरना त्रुटि दिखाएं।',
    'ग्राहक उत्पाद खोजता है। अगर मिलता है तो कार्ट में जोड़ें, नहीं तो "नहीं मिला" दिखाएं।',
  ],
  JA: [
    'ユーザーがログインします。認証情報が正しければダッシュボードを表示、そうでなければエラーを表示して再試行します。',
  ],
  ZH: [
    '用户提交申请。如果申请有效，则处理申请。否则显示错误并要求用户重新填写。',
  ],
};

// ─── Manual palette shapes ────────────────────────────────────────────────────

const PALETTE_SHAPES = [
  {
    type: 'process', label: 'Process', desc: 'Action / step',
    preview: (
      <svg viewBox="0 0 80 34" className="w-full h-8">
        <rect x="3" y="3" width="74" height="28" rx="6" fill="rgba(71,85,105,0.5)" stroke="rgba(148,163,184,0.6)" strokeWidth="1.5" />
      </svg>
    ),
    color: 'text-slate-300', activeBg: 'bg-slate-700/60', activeBorder: 'border-slate-500',
  },
  {
    type: 'decision', label: 'Decision', desc: 'Branch / condition',
    preview: (
      <svg viewBox="0 0 80 50" className="w-full h-10">
        <polygon points="40,4 76,25 40,46 4,25" fill="rgba(120,53,15,0.5)" stroke="rgba(217,119,6,0.7)" strokeWidth="1.5" />
      </svg>
    ),
    color: 'text-amber-300', activeBg: 'bg-amber-900/50', activeBorder: 'border-amber-600',
  },
  {
    type: 'start', label: 'Start', desc: 'Entry point',
    preview: (
      <svg viewBox="0 0 80 30" className="w-full h-7">
        <rect x="3" y="3" width="74" height="24" rx="12" fill="rgba(67,56,202,0.5)" stroke="rgba(129,140,248,0.7)" strokeWidth="1.5" />
      </svg>
    ),
    color: 'text-indigo-300', activeBg: 'bg-indigo-900/50', activeBorder: 'border-indigo-500',
  },
  {
    type: 'end', label: 'End', desc: 'Terminal',
    preview: (
      <svg viewBox="0 0 80 30" className="w-full h-7">
        <rect x="3" y="3" width="74" height="24" rx="12" fill="rgba(6,78,59,0.5)" stroke="rgba(52,211,153,0.7)" strokeWidth="1.5" />
      </svg>
    ),
    color: 'text-emerald-300', activeBg: 'bg-emerald-900/50', activeBorder: 'border-emerald-500',
  },
  {
    type: 'io', label: 'I / O', desc: 'Input / Output',
    preview: (
      <svg viewBox="0 0 80 30" className="w-full h-7">
        <polygon points="12,3 77,3 68,27 3,27" fill="rgba(8,145,178,0.3)" stroke="rgba(6,182,212,0.7)" strokeWidth="1.5" />
      </svg>
    ),
    color: 'text-cyan-300', activeBg: 'bg-cyan-900/50', activeBorder: 'border-cyan-500',
  },
  {
    type: 'database', label: 'Database', desc: 'Storage',
    preview: (
      <svg viewBox="0 0 80 44" className="w-full h-10">
        <rect x="4" y="10" width="72" height="26" fill="rgba(109,40,217,0.3)" stroke="rgba(139,92,246,0.7)" strokeWidth="1.5" />
        <ellipse cx="40" cy="10" rx="36" ry="8" fill="rgba(109,40,217,0.5)" stroke="rgba(139,92,246,0.7)" strokeWidth="1.5" />
        <ellipse cx="40" cy="36" rx="36" ry="8" fill="rgba(109,40,217,0.3)" stroke="rgba(139,92,246,0.7)" strokeWidth="1.5" />
      </svg>
    ),
    color: 'text-violet-300', activeBg: 'bg-violet-900/50', activeBorder: 'border-violet-500',
  },
  {
    type: 'document', label: 'Document', desc: 'File / report',
    preview: (
      <svg viewBox="0 0 80 36" className="w-full h-8">
        <path d="M3,3 H77 V26 Q68,36 57,26 Q48,16 40,26 Q32,36 23,26 Q14,16 3,26 Z" fill="rgba(13,148,136,0.3)" stroke="rgba(20,184,166,0.7)" strokeWidth="1.5" />
      </svg>
    ),
    color: 'text-teal-300', activeBg: 'bg-teal-900/50', activeBorder: 'border-teal-500',
  },
  {
    type: 'hexagon', label: 'Prep', desc: 'Preparation',
    preview: (
      <svg viewBox="0 0 80 34" className="w-full h-8">
        <polygon points="20,3 60,3 77,17 60,31 20,31 3,17" fill="rgba(154,52,18,0.3)" stroke="rgba(249,115,22,0.7)" strokeWidth="1.5" />
      </svg>
    ),
    color: 'text-orange-300', activeBg: 'bg-orange-900/50', activeBorder: 'border-orange-500',
  },
];

// ─── Language picker ──────────────────────────────────────────────────────────

function LanguagePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === value) || LANGUAGES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Select language"
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gray-800/80 border border-gray-700/70 text-xs text-gray-300 hover:border-indigo-500/50 hover:text-white transition-all"
      >
        <span className="text-sm leading-none">{current.flag}</span>
        <span className="font-medium">{current.code}</span>
        <svg className="w-2.5 h-2.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-36 bg-gray-900 border border-gray-700/80 rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { onChange(lang.code); setOpen(false); }}
              className={`
                w-full text-left px-3 py-2 text-xs flex items-center gap-2.5 transition-colors
                ${value === lang.code ? 'bg-indigo-600/30 text-indigo-200' : 'text-gray-300 hover:bg-gray-800'}
              `}
            >
              <span className="text-sm">{lang.flag}</span>
              <span>{lang.name}</span>
              {value === lang.code && (
                <svg className="w-3 h-3 ml-auto text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Manual shape palette ─────────────────────────────────────────────────────

function ManualPalette({ onAddNode }) {
  const [adding, setAdding] = useState(null); // type being named
  const [label, setLabel] = useState('');
  const [dragging, setDragging] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (adding) {
      setLabel(PALETTE_SHAPES.find((s) => s.type === adding)?.label || '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [adding]);

  const handleAdd = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onAddNode(adding, trimmed);
    setAdding(null);
    setLabel('');
  };

  const handleDragStart = (e, shape) => {
    e.dataTransfer.setData('application/flowmind-node-type', shape.type);
    e.dataTransfer.setData('application/flowmind-node-label', shape.label);
    e.dataTransfer.effectAllowed = 'copy';
    setDragging(shape.type);
    setAdding(null); // close any open label input
  };

  return (
    <div className="flex flex-col h-full px-4 py-4 gap-4 overflow-y-auto">
      {/* Title */}
      <div>
        <h2 className="text-gray-200 font-semibold text-sm">Shape Palette</h2>
        <p className="text-gray-500 text-xs mt-0.5">
          Click to add · <span className="text-indigo-400">drag onto canvas</span> to place
        </p>
      </div>

      {/* Shape grid */}
      <div className="grid grid-cols-2 gap-2">
        {PALETTE_SHAPES.map((shape) => (
          <div
            key={shape.type}
            draggable
            onDragStart={(e) => handleDragStart(e, shape)}
            onDragEnd={() => setDragging(null)}
            onClick={() => setAdding(shape.type === adding ? null : shape.type)}
            className={`
              flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-150 text-left
              cursor-grab active:cursor-grabbing select-none
              ${dragging === shape.type
                ? 'opacity-50 scale-95'
                : adding === shape.type
                ? `${shape.activeBg} ${shape.activeBorder} shadow-sm`
                : 'bg-gray-800/40 border-gray-700/60 hover:bg-gray-800/70 hover:border-gray-600'}
            `}
          >
            <div className="w-full pointer-events-none">{shape.preview}</div>
            <div className="w-full pointer-events-none">
              <p className={`text-xs font-semibold leading-none ${adding === shape.type ? shape.color : 'text-gray-300'}`}>
                {shape.label}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5">{shape.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Label input — shown when a shape is selected */}
      {adding && (
        <div className="bg-gray-800/60 border border-gray-700/60 rounded-xl p-3 space-y-2">
          <p className="text-xs text-gray-400 font-medium">Label for {PALETTE_SHAPES.find(s => s.type === adding)?.label}</p>
          <input
            ref={inputRef}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(null); }}
            placeholder="Enter label…"
            className="w-full bg-gray-900/80 border border-gray-700/60 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/70 transition-colors placeholder-gray-600"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!label.trim()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg py-1.5 transition-colors"
            >
              Add to Canvas
            </button>
            <button
              onClick={() => setAdding(null)}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 rounded-lg border border-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Quick tips */}
      <div className="mt-auto border-t border-gray-800/60 pt-3 space-y-1.5">
        <p className="text-[10px] text-gray-600 font-medium uppercase tracking-wider mb-1">Tips</p>
        {[
          ['↗', 'Drag node handle to connect'],
          ['↩', 'Hover edge endpoint to reconnect'],
          ['✕', 'Hover edge to delete it'],
          ['✎', 'Double-click node to rename'],
          ['⌘Z', 'Ctrl+Z to undo'],
        ].map(([icon, tip]) => (
          <div key={tip} className="flex items-center gap-2">
            <span className="text-gray-600 text-[10px] w-5 text-center">{icon}</span>
            <span className="text-gray-500 text-[10px]">{tip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Plan / message bubbles ───────────────────────────────────────────────────

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function PlanBubble({ message, showButtons, onConfirm, onCancel }) {
  return (
    <div className="flex gap-2.5 animate-fade-in">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-800/80 border border-indigo-600/60 flex items-center justify-center text-[10px] font-bold text-indigo-200 mt-0.5">
        AI
      </div>
      <div className="flex flex-col gap-2 max-w-[84%] items-start">
        <div className="message-assistant px-3.5 py-3 rounded-2xl rounded-tl-sm text-sm text-gray-100 leading-relaxed">
          <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            Proposed Flowchart
          </p>
          <p className="whitespace-pre-wrap break-words text-gray-200">{message.content}</p>
        </div>
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
      <div className={`
        flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5
        ${isUser
          ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-900/40'
          : isError
          ? 'bg-red-900/80 text-red-300 border border-red-700'
          : 'bg-gray-700/80 text-gray-300 border border-gray-600'}
      `}>
        {isUser ? 'U' : isError ? '!' : 'AI'}
      </div>
      <div className={`flex flex-col gap-1 max-w-[84%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`
          px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'message-user text-white rounded-tr-sm'
            : isError
            ? 'message-error text-red-200 rounded-tl-sm'
            : 'message-assistant text-gray-100 rounded-tl-sm'}
        `}>
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

function SamplePrompts({ language, onSelect }) {
  const prompts = SAMPLE_PROMPTS[language] || SAMPLE_PROMPTS.EN;

  return (
    <div className="flex flex-col justify-center px-4 py-5 space-y-4 h-full">
      <div className="text-center space-y-1">
        <div className="w-10 h-10 mx-auto rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-900/40 mb-3">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <h2 className="text-gray-200 font-semibold text-sm">Describe any process</h2>
        <p className="text-gray-500 text-xs leading-relaxed">
          Type in plain language — FlowMind turns it into a flowchart
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-gray-600 text-[10px] uppercase tracking-wider font-medium px-0.5">Try an example</p>
        {prompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(prompt)}
            className="w-full text-left text-xs text-gray-400 bg-gray-800/50 hover:bg-gray-700/60 border border-gray-700/60 hover:border-indigo-500/40 rounded-xl px-3.5 py-2.5 transition-all duration-150 leading-relaxed line-clamp-3"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main ChatPanel ───────────────────────────────────────────────────────────

export default function ChatPanel({ messages, onSend, isLoading, hasFlowchart, hasPending, onConfirm, onCancel, onAddNode }) {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('ai');          // 'ai' | 'manual'
  const [language, setLanguage] = useState('EN');  // current language
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (mode === 'ai') textareaRef.current?.focus();
  }, [mode]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [input, isLoading, onSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }, [handleSubmit]);

  const handleTextareaInput = useCallback((e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }, []);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full bg-panel">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-3.5 pb-3 border-b border-white/[0.06]">
        {/* Row 1: Logo + App name */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/50 flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-sm leading-none tracking-tight">FlowMind</h1>
              <p className="text-gray-500 text-[10px] mt-0.5 leading-none">AI Flowchart Generator</p>
            </div>
          </div>

          {/* Status + Language */}
          <div className="flex items-center gap-2">
            {/* Status pill */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium border transition-all duration-300 ${
              isLoading
                ? 'bg-amber-950/50 border-amber-800/50 text-amber-400'
                : 'bg-emerald-950/50 border-emerald-800/50 text-emerald-400'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              {isLoading ? 'Working' : 'Ready'}
            </div>

            {/* Language picker — top-right corner */}
            <LanguagePicker value={language} onChange={setLanguage} />
          </div>
        </div>

        {/* Row 2: Mode toggle */}
        <div className="flex items-center bg-gray-800/60 rounded-xl p-0.5 border border-white/[0.06]">
          <button
            onClick={() => setMode('ai')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              mode === 'ai'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            AI Generate
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              mode === 'manual'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
            Manual Draw
          </button>
        </div>
      </div>

      {/* ─── Content area ────────────────────────────────────────────────── */}
      {mode === 'manual' ? (
        <div className="flex-1 overflow-y-auto">
          <ManualPalette onAddNode={onAddNode} />
        </div>
      ) : (
        <>
          {/* Messages / prompts */}
          <div className="flex-1 overflow-y-auto">
            {!hasMessages ? (
              <SamplePrompts language={language} onSelect={(p) => setInput(p)} />
            ) : (
              <div className="px-4 py-4 space-y-4">
                {messages.map((msg, idx) => {
                  if (msg.type === 'plan') {
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

          {/* Edit mode hint */}
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

          {/* Input */}
          <div className="flex-shrink-0 border-t border-white/[0.05] px-4 py-3.5">
            <div className={`
              flex items-end gap-2.5 rounded-2xl px-3.5 py-2.5 border transition-all duration-200
              ${isLoading
                ? 'bg-gray-800/30 border-gray-700/40 opacity-60'
                : 'bg-gray-800/50 border-gray-700/50 focus-within:border-indigo-500/60 focus-within:bg-gray-800/70 focus-within:shadow-lg focus-within:shadow-indigo-900/20'}
            `}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                rows={1}
                placeholder={hasFlowchart ? 'Describe changes to your flowchart…' : 'Describe a process or workflow…'}
                className="flex-1 bg-transparent text-gray-200 text-sm placeholder-gray-600 resize-none outline-none border-none leading-relaxed py-0.5 disabled:cursor-not-allowed"
                style={{ minHeight: '32px', maxHeight: '150px' }}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isLoading}
                className="flex-shrink-0 mb-0.5 w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 shadow-sm shadow-indigo-900/50"
                aria-label="Send"
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
            <p className="text-gray-700 text-[10px] text-center mt-2">Enter to send · Shift+Enter for new line</p>
          </div>
        </>
      )}
    </div>
  );
}
