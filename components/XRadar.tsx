'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SearchParams,
  DEFAULT_PARAMS,
  buildSearchQuery,
  buildSearchUrl,
} from '../lib/searchBuilder';
import {
  HistoryEntry,
  getHistory,
  saveSearch,
  deleteSearch,
  clearHistory,
} from '../lib/history';

// ─── Helpers ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: '', label: 'Any Language' },
  { code: 'en', label: '🇺🇸 English' },
  { code: 'es', label: '🇪🇸 Spanish' },
  { code: 'fr', label: '🇫🇷 French' },
  { code: 'de', label: '🇩🇪 German' },
  { code: 'pt', label: '🇧🇷 Portuguese' },
  { code: 'ja', label: '🇯🇵 Japanese' },
  { code: 'hi', label: '🇮🇳 Hindi' },
  { code: 'ar', label: '🇸🇦 Arabic' },
  { code: 'zh', label: '🇨🇳 Chinese' },
  { code: 'ko', label: '🇰🇷 Korean' },
  { code: 'it', label: '🇮🇹 Italian' },
  { code: 'ru', label: '🇷🇺 Russian' },
];

// Logarithmic slider scale for engagement values
function sliderToValue(sliderVal: number): number {
  if (sliderVal === 0) return 0;
  // 0–100 → 0–500K exponential
  return Math.round(Math.pow(10, (sliderVal / 100) * 5.7));
}

function valueToSlider(value: number): number {
  if (value === 0) return 0;
  return Math.round((Math.log10(value) / 5.7) * 100);
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `${n}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <div
      id={id}
      className={`toggle-track ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onChange(!checked)}
    >
      <div className="toggle-thumb" />
    </div>
  );
}

function SliderControl({
  label,
  value,
  onChange,
  icon,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  icon: string;
  color: string;
}) {
  const sliderVal = valueToSlider(value);

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(sliderToValue(Number(e.target.value)));
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const num = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) onChange(Math.min(num, 500_000_000));
  };

  const filledPercent = sliderVal;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        </div>
        <input
          type="text"
          value={value === 0 ? '' : value.toString()}
          onChange={handleInput}
          placeholder="0"
          className="x-input text-right text-sm font-mono"
          style={{ width: 90, padding: '4px 10px' }}
        />
      </div>
      <div className="relative">
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full pointer-events-none"
          style={{ width: `${filledPercent}%`, background: color, transition: 'width 0.1s' }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={sliderVal}
          onChange={handleSlider}
          className="x-slider"
          style={{
            background: `linear-gradient(to right, ${color} 0%, ${color} ${filledPercent}%, rgba(255,255,255,0.08) ${filledPercent}%, rgba(255,255,255,0.08) 100%)`,
          }}
        />
      </div>
      <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>0</span>
        <span className="font-medium" style={{ color: value > 0 ? color : 'var(--text-muted)' }}>
          {value > 0 ? `min ${formatCount(value)}` : 'Any'}
        </span>
        <span>500K+</span>
      </div>
    </div>
  );
}

function QueryPreview({ query }: { query: string }) {
  if (!query) return null;

  // Syntax highlight
  const parts: { text: string; cls: string }[] = [];
  const tokens = query.split(' ').filter(Boolean);
  tokens.forEach((token, i) => {
    let cls = 'q-keyword';
    if (token.startsWith('from:') || token.startsWith('min_faves:') || token.startsWith('min_retweets:') || token.startsWith('min_replies:') || token.startsWith('since:') || token.startsWith('until:') || token.startsWith('lang:')) {
      const [op, val] = token.split(':');
      parts.push({ text: op + ':', cls: 'q-operator' });
      parts.push({ text: (i < tokens.length - 1 ? val + ' ' : val), cls: 'q-value' });
      return;
    } else if (token.startsWith('-filter:') || token.startsWith('-')) {
      cls = 'q-exclude';
    } else if (token.startsWith('filter:')) {
      cls = 'q-filter';
    } else if (token.startsWith('"')) {
      cls = 'q-phrase';
    } else if (token.startsWith('(')) {
      cls = 'q-phrase';
    }
    parts.push({ text: token + (i < tokens.length - 1 ? ' ' : ''), cls });
  });

  return (
    <p className="query-preview">
      {parts.map((p, i) => (
        <span key={i} className={p.cls}>{p.text}</span>
      ))}
    </p>
  );
}

function HistoryPanel({
  history,
  onLoad,
  onDelete,
  onClear,
}: {
  history: HistoryEntry[];
  onLoad: (e: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}) {
  if (history.length === 0) return null;

  return (
    <div className="glass-card p-5 animate-fade-in-delay-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-base">🕒</span>
          <span className="font-semibold text-sm" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-secondary)' }}>Recent Searches</span>
        </div>
        <button
          onClick={onClear}
          className="text-xs px-3 py-1 rounded-lg"
          style={{ color: 'var(--red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', cursor: 'pointer', transition: 'all 0.2s' }}
        >
          Clear all
        </button>
      </div>
      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
        {history.map((entry) => (
          <div key={entry.id} className="history-item group" onClick={() => onLoad(entry)}>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{entry.query}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {entry.params.mode === 'topic' ? '🎯 Topic Hunt' : '🔍 Creator Dive'} • {new Date(entry.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
              className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded-md transition-opacity"
              style={{ color: 'var(--red)', background: 'rgba(248,113,113,0.1)', border: 'none', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Any', likes: 0, retweets: 0, replies: 0 },
  { label: '🔥 Low', likes: 1000, retweets: 200, replies: 50 },
  { label: '⚡ High', likes: 10000, retweets: 2000, replies: 500 },
  { label: '🚀 Mega Viral', likes: 100000, retweets: 20000, replies: 5000 },
];

export default function XRadar() {
  const [params, setParams] = useState<SearchParams>(DEFAULT_PARAMS);
  const [query, setQuery] = useState('');
  const [url, setUrl] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copyState, setCopyState] = useState<'idle' | 'query' | 'url'>('idle');
  const [activePreset, setActivePreset] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchError, setSearchError] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    setHistory(getHistory());
  }, []);

  // Rebuild query whenever params change
  useEffect(() => {
    const q = buildSearchQuery(params);
    const u = buildSearchUrl(q);
    setQuery(q);
    setUrl(u);
  }, [params]);

  const set = useCallback(<K extends keyof SearchParams>(key: K, value: SearchParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  const applyPreset = (idx: number) => {
    const p = PRESETS[idx];
    setActivePreset(idx);
    setParams((prev) => ({ ...prev, minLikes: p.likes, minRetweets: p.retweets, minReplies: p.replies }));
  };

  const handleSearch = () => {
    if (!query.trim()) {
      setSearchError(params.mode === 'topic' ? 'Enter a keyword or topic first.' : 'Enter a username first.');
      setTimeout(() => setSearchError(''), 3000);
      return;
    }
    setSearchError('');
    const label =
      params.mode === 'creator' ? `@${params.username}` : params.keyword || 'Search';
    saveSearch({ query, url, params, label });
    setHistory(getHistory());
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = async (type: 'query' | 'url') => {
    const text = type === 'query' ? query : url;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopyState(type);
    setTimeout(() => setCopyState('idle'), 1800);
  };

  const loadHistory = (entry: HistoryEntry) => {
    setParams(entry.params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteHistoryEntry = (id: string) => {
    setHistory(deleteSearch(id));
  };

  const clearAllHistory = () => {
    clearHistory();
    setHistory([]);
  };

  // Sync slider → reset preset if manually changed
  const handleEngagement = (key: 'minLikes' | 'minRetweets' | 'minReplies', val: number) => {
    set(key, val);
    setActivePreset(-1);
  };

  const isValid = query.trim().length > 0;

  return (
    <div className="relative z-10 min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12 pb-24">

        {/* ── Header ── */}
        <header className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 0 30px rgba(99,102,241,0.4)' }}
            >
              📡
            </div>
            <h1
              className="text-4xl font-bold tracking-tight"
              style={{ fontFamily: 'Space Grotesk, sans-serif', background: 'linear-gradient(135deg, #f0f4ff 0%, #818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              XRadar
            </h1>
          </div>
          <p className="text-lg mb-2" style={{ color: 'var(--text-secondary)' }}>
            Advanced X search — <span style={{ color: 'var(--accent-2)' }}>find signal, cut the noise</span>
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No API · No signup · Completely free
          </p>
        </header>

        {/* ── Mode Switcher ── */}
        <div className="glass-card p-1.5 mb-6 animate-fade-in-delay-1">
          <div className="relative flex">
            {/* Sliding pill */}
            <div
              className="absolute top-0 bottom-0 w-1/2 rounded-[10px] transition-all duration-300 ease-out"
              style={{
                left: params.mode === 'topic' ? '0%' : '50%',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(79,70,229,0.3))',
                border: '1px solid rgba(99,102,241,0.4)',
                boxShadow: '0 0 20px rgba(99,102,241,0.15)',
              }}
            />
            <button
              className={`mode-tab flex-1 flex items-center justify-center gap-2 ${params.mode === 'topic' ? 'active' : ''}`}
              onClick={() => set('mode', 'topic')}
              id="mode-topic"
            >
              <span>🎯</span> Topic Hunt
            </button>
            <button
              className={`mode-tab flex-1 flex items-center justify-center gap-2 ${params.mode === 'creator' ? 'active' : ''}`}
              onClick={() => set('mode', 'creator')}
              id="mode-creator"
            >
              <span>🔍</span> Creator Deep Dive
            </button>
          </div>
        </div>

        {/* ── Mode description ── */}
        <p className="text-sm text-center mb-6 animate-fade-in-delay-1" style={{ color: 'var(--text-muted)' }}>
          {params.mode === 'topic'
            ? 'Discover the highest-performing posts on any topic, keyword, or niche.'
            : "Analyze any creator's greatest hits — skip the noise, find the bangers."}
        </p>

        {/* ── Primary Input ── */}
        <div className="glass-card p-6 mb-4 animate-fade-in-delay-2">
          {params.mode === 'creator' ? (
            <div className="flex flex-col gap-2">
              <label className="section-label">Twitter / X Username</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base" style={{ color: 'var(--text-muted)' }}>@</span>
                <input
                  type="text"
                  id="input-username"
                  value={params.username}
                  onChange={(e) => set('username', e.target.value.replace(/^@/, ''))}
                  placeholder="elonmusk"
                  className="x-input"
                  style={{ paddingLeft: '2.5rem', paddingRight: '1rem', paddingTop: '0.75rem', paddingBottom: '0.75rem' }}
                />
              </div>
              {/* Also allow keyword for creator mode */}
              <label className="section-label mt-3">Keyword Filter (optional)</label>
              <input
                type="text"
                id="input-creator-keyword"
                value={params.keyword}
                onChange={(e) => set('keyword', e.target.value)}
                placeholder="e.g. AI, startup, productivity"
                className="x-input"
                style={{ padding: '0.75rem 1rem' }}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="section-label">Keyword / Topic</label>
              <input
                type="text"
                id="input-keyword"
                value={params.keyword}
                onChange={(e) => set('keyword', e.target.value)}
                placeholder="e.g. AI, Next.js, startup ideas..."
                className="x-input"
                style={{ padding: '0.75rem 1rem', fontSize: '16px' }}
              />
            </div>
          )}
        </div>

        {/* ── Viral Presets ── */}
        <div className="glass-card p-5 mb-4 animate-fade-in-delay-2">
          <div className="flex items-center justify-between mb-4">
            <span className="section-label">Viral Threshold</span>
            <div className="flex gap-2 flex-wrap justify-end">
              {PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  id={`preset-${i}`}
                  className="preset-btn"
                  onClick={() => applyPreset(i)}
                  style={{
                    background: activePreset === i
                      ? 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(79,70,229,0.3))'
                      : 'rgba(255,255,255,0.05)',
                    color: activePreset === i ? 'white' : 'var(--text-secondary)',
                    borderColor: activePreset === i ? 'rgba(99,102,241,0.5)' : 'var(--border-subtle)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders */}
          <div className="flex flex-col gap-6">
            <SliderControl
              label="Minimum Likes"
              value={params.minLikes}
              onChange={(v) => handleEngagement('minLikes', v)}
              icon="❤️"
              color="#f472b6"
            />
            <SliderControl
              label="Minimum Retweets"
              value={params.minRetweets}
              onChange={(v) => handleEngagement('minRetweets', v)}
              icon="🔁"
              color="#34d399"
            />
            <SliderControl
              label="Minimum Replies"
              value={params.minReplies}
              onChange={(v) => handleEngagement('minReplies', v)}
              icon="💬"
              color="#60a5fa"
            />
          </div>
        </div>

        {/* ── Quick Toggles ── */}
        <div className="glass-card p-5 mb-4 animate-fade-in-delay-2">
          <span className="section-label block mb-4">Quick Filters</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'excludeRetweets' as const, label: 'Exclude Retweets', desc: '-filter:nativeretweets', emoji: '🚫' },
              { key: 'excludeReplies' as const, label: 'Exclude Replies', desc: '-filter:replies', emoji: '🙊' },
              { key: 'mediaOnly' as const, label: 'Media Only', desc: 'filter:media', emoji: '🎬' },
            ].map(({ key, label, desc, emoji }) => (
              <label key={key} className="flex items-center justify-between gap-3 cursor-pointer">
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <span>{emoji}</span>
                    <span style={{ color: 'var(--text-primary)' }}>{label}</span>
                  </p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </div>
                <Toggle
                  id={`toggle-${key}`}
                  checked={params[key] as boolean}
                  onChange={(v) => {
                    if (key === 'mediaOnly' && v) {
                      setParams((p) => ({ ...p, mediaOnly: true, imagesOnly: false, videosOnly: false, linksOnly: false }));
                    } else {
                      set(key, v);
                    }
                  }}
                />
              </label>
            ))}
          </div>
        </div>

        {/* ── Advanced Section ── */}
        <div className="mb-4 animate-fade-in-delay-2">
          <button
            id="toggle-advanced"
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 rounded-2xl transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontFamily: 'Space Grotesk, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <span className="flex items-center gap-2">
              <span>⚙️</span> Advanced Options
            </span>
            <span style={{ transition: 'transform 0.3s', transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}>▼</span>
          </button>

          {showAdvanced && (
            <div className="glass-card p-5 mt-2 flex flex-col gap-5">

              {/* Media sub-filters */}
              <div>
                <span className="section-label block mb-3">Media Type</span>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'imagesOnly' as const, label: '🖼️ Images', op: 'filter:images' },
                    { key: 'videosOnly' as const, label: '🎥 Videos', op: 'filter:videos' },
                    { key: 'linksOnly' as const, label: '🔗 Links', op: 'filter:links' },
                  ].map(({ key, label, op }) => (
                    <button
                      key={key}
                      id={`media-${key}`}
                      onClick={() => {
                        const next = !params[key];
                        setParams((p) => ({
                          ...p,
                          imagesOnly: false,
                          videosOnly: false,
                          linksOnly: false,
                          mediaOnly: false,
                          [key]: next,
                        }));
                      }}
                      className="preset-btn text-xs"
                      style={{
                        background: params[key] ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.05)',
                        color: params[key] ? 'var(--cyan)' : 'var(--text-secondary)',
                        borderColor: params[key] ? 'rgba(34,211,238,0.4)' : 'var(--border-subtle)',
                      }}
                    >
                      {label}
                      <span className="ml-1.5 text-xs opacity-60 font-mono">{op}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="x-divider" />

              {/* Keyword filters */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="section-label block mb-2">Exact Phrase</label>
                  <input
                    type="text"
                    id="input-exact"
                    value={params.exactPhrase}
                    onChange={(e) => set('exactPhrase', e.target.value)}
                    placeholder='e.g. "make it happen"'
                    className="x-input"
                    style={{ padding: '0.6rem 0.875rem' }}
                  />
                </div>
                <div>
                  <label className="section-label block mb-2">OR Keywords <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(comma-separated)</span></label>
                  <input
                    type="text"
                    id="input-or"
                    value={params.orKeywords}
                    onChange={(e) => set('orKeywords', e.target.value)}
                    placeholder="e.g. AI, LLM, GPT"
                    className="x-input"
                    style={{ padding: '0.6rem 0.875rem' }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="section-label block mb-2">Exclude Keywords <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(comma-separated)</span></label>
                  <input
                    type="text"
                    id="input-exclude"
                    value={params.excludeKeywords}
                    onChange={(e) => set('excludeKeywords', e.target.value)}
                    placeholder="e.g. spam, ad, promo"
                    className="x-input"
                    style={{ padding: '0.6rem 0.875rem' }}
                  />
                </div>
              </div>

              <div className="x-divider" />

              {/* Date range */}
              <div>
                <span className="section-label block mb-3">📅 Date Range</span>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>From (since:)</label>
                    <input
                      type="date"
                      id="input-since"
                      value={params.sinceDate}
                      onChange={(e) => set('sinceDate', e.target.value)}
                      className="x-input"
                      style={{ padding: '0.6rem 0.875rem', colorScheme: 'dark' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>To (until:)</label>
                    <input
                      type="date"
                      id="input-until"
                      value={params.untilDate}
                      onChange={(e) => set('untilDate', e.target.value)}
                      className="x-input"
                      style={{ padding: '0.6rem 0.875rem', colorScheme: 'dark' }}
                    />
                  </div>
                </div>
              </div>

              <div className="x-divider" />

              {/* Language */}
              <div>
                <span className="section-label block mb-3">🌐 Language</span>
                <select
                  id="select-language"
                  value={params.language}
                  onChange={(e) => set('language', e.target.value)}
                  className="x-input"
                  style={{ padding: '0.6rem 0.875rem', cursor: 'pointer' }}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} style={{ background: '#0a0f1e' }}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ── Live Query Preview ── */}
        {query && (
          <div ref={previewRef} className="glass-card p-5 mb-4 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <span className="section-label">Live Query Preview</span>
              <div className="flex gap-1.5">
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--accent-2)', border: '1px solid rgba(99,102,241,0.3)' }}
                >
                  {query.split(' ').filter(Boolean).length} tokens
                </span>
              </div>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <QueryPreview query={query} />
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {searchError && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm animate-fade-in"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: 'var(--red)' }}>
            ⚠️ {searchError}
          </div>
        )}

        {/* ── Action Buttons ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4 animate-fade-in-delay-3">
          <button
            id="btn-open-x"
            onClick={handleSearch}
            className="btn-primary flex-1 py-4 text-base flex items-center justify-center gap-2"
            style={{ opacity: isValid ? 1 : 0.5 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
            </svg>
            Open in X
          </button>

          <button
            id="btn-copy-url"
            onClick={() => handleCopy('url')}
            className="btn-secondary flex-1 py-4 text-sm flex items-center justify-center gap-2"
            style={{ opacity: isValid ? 1 : 0.5 }}
          >
            {copyState === 'url' ? '✅ URL Copied!' : '🔗 Copy URL'}
          </button>

          <button
            id="btn-copy-query"
            onClick={() => handleCopy('query')}
            className="btn-secondary py-4 px-5 text-sm flex items-center justify-center gap-2"
            style={{ opacity: isValid ? 1 : 0.5 }}
          >
            {copyState === 'query' ? '✅ Copied!' : '📋 Copy Query'}
          </button>
        </div>

        {/* ── History ── */}
        <HistoryPanel
          history={history}
          onLoad={loadHistory}
          onDelete={deleteHistoryEntry}
          onClear={clearAllHistory}
        />

        {/* ── Footer ── */}
        <footer className="text-center mt-12 pt-8" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            XRadar · <a href="https://xradar.xyz" style={{ color: 'var(--accent-2)', textDecoration: 'none' }}>xradar.xyz</a> ·{' '}
            <span>No API · No data collected · 100% client-side</span>
          </p>
        </footer>

      </div>
    </div>
  );
}
