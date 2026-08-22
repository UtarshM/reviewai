"use client";

import React, { useState, useEffect } from 'react';

export default function AnalyticsTab({ activeBusiness, token }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('monthly');

  useEffect(() => {
    if (activeBusiness) fetchInsights();
  }, [activeBusiness, period]);

  const fetchInsights = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/v1/insights?business_id=${activeBusiness.id}&period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.insights) {
        setInsights(typeof data.insights === 'string' ? JSON.parse(data.insights) : data.insights);
      } else {
        setInsights(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const response = await fetch('/api/v1/insights/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ business_id: activeBusiness.id, period })
      });
      const data = await response.json();
      if (data.error) setError(data.message || 'Failed');
      else if (data.insights) setInsights(typeof data.insights === 'string' ? JSON.parse(data.insights) : data.insights);
    } catch (err) {
      setError('Network error.');
    } finally {
      setGenerating(false);
    }
  };

  const d = insights || {
    overall_sentiment_score: 88,
    customer_mood: "Delighted",
    next_month_predicted_rating: 4.8,
    strengths: ["Staff Friendliness", "Food Quality"],
    weaknesses: ["Wait Times"],
    product_mentions: [
      { name: "Margherita Pizza", sentiment: "92% Positive", percent: 92 },
      { name: "Truffle Pasta", sentiment: "85% Positive", percent: 85 },
      { name: "Signature Cocktails", sentiment: "78% Positive", percent: 78 },
      { name: "Dessert Platter", sentiment: "Neutral - 60%", percent: 60 }
    ],
    biggest_opportunity: "Improving check-out speed could boost overall rating by 0.3 stars."
  };

  if (loading && !insights) {
    return (
      <div className="flex flex-col items-center justify-center py-3xl animate-fade-in">
        <span className="material-symbols-outlined text-[32px] text-primary animate-spin">sync</span>
        <p className="text-body-sm text-on-surface-variant mt-md font-medium">Loading insights...</p>
      </div>
    );
  }

  return (
    <div className="space-y-lg animate-fade-in">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-md pb-sm">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface mb-xs">Analytics Overview</h1>
          <p className="font-body-md text-on-surface-variant">Real-time AI-driven customer sentiment & trend forecasting.</p>
        </div>
        <div className="flex gap-sm items-center">
          <select
            style={{
              background: 'white',
              border: '1px solid var(--color-outline-variant)',
              outline: 'none',
              cursor: 'pointer'
            }}
            className="font-label-md text-label-md px-md py-2 rounded-lg text-on-surface hover:bg-surface-container-low transition"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="weekly">Last 7 Days</option>
            <option value="monthly">Last 30 Days</option>
            <option value="quarterly">Last 90 Days</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-primary text-on-primary font-label-md text-label-md px-lg py-2 rounded-lg hover:brightness-110 active:scale-98 transition flex items-center gap-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            {generating ? 'Analyzing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-error-container border border-error/20 text-on-error-container p-md rounded-lg text-body-sm font-medium">
          {error}
        </div>
      )}

      {/* Top Level Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
        {/* Sentiment Score */}
        <div className="glass-panel p-lg rounded-2xl relative overflow-hidden group">
          <div className="flex justify-between items-start mb-md">
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">Sentiment Score</p>
              <h2 className="font-display-lg text-display-lg text-secondary">{d.overall_sentiment_score}%</h2>
            </div>
            <div className="p-2 bg-secondary-container rounded-lg sentiment-glow-pos flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary">sentiment_very_satisfied</span>
            </div>
          </div>
          <div className="flex items-center gap-sm mt-lg">
            <div className="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-secondary transition-all duration-1000" style={{ width: `${d.overall_sentiment_score}%` }}></div>
            </div>
            <span className="font-label-md text-label-md text-secondary whitespace-nowrap">+12% vs LY</span>
          </div>
        </div>

        {/* Customer Mood */}
        <div className="glass-panel p-lg rounded-2xl relative overflow-hidden group flex flex-col justify-between">
          <div className="flex justify-between items-start mb-md">
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">Customer Mood</p>
              <h2 className="font-display-lg text-display-lg text-primary">{d.customer_mood || "Delighted"}</h2>
            </div>
            <div className="p-2 bg-primary-container rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">mood</span>
            </div>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-sm">Dominant sentiment trend across reviews analyzed this period.</p>
        </div>

        {/* Predicted Rating */}
        <div className="glass-panel p-lg rounded-2xl relative overflow-hidden group flex flex-col justify-between">
          <div className="flex justify-between items-start mb-md">
            <div>
              <p className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider mb-xs">Predicted Rating</p>
              <h2 className="font-display-lg text-display-lg text-tertiary">{d.next_month_predicted_rating || "4.8"}</h2>
            </div>
            <div className="p-2 bg-tertiary-container rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary">auto_graph</span>
            </div>
          </div>
          <div className="flex items-center gap-xs text-on-surface-variant mt-sm">
            <span className="material-symbols-outlined text-[16px]">trending_up</span>
            <span className="font-label-md text-label-md">Next month forecast based on trajectory</span>
          </div>
        </div>
      </div>

      {/* Mid Section: Strengths/Weaknesses & Product Mentions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        {/* Left Column: Strengths & Weaknesses */}
        <div className="space-y-lg">
          {/* Strengths */}
          <div className="glass-panel p-lg rounded-2xl">
            <div className="flex items-center gap-sm mb-lg">
              <span className="material-symbols-outlined text-secondary">thumb_up</span>
              <h3 className="font-headline-md text-headline-md">Top Strengths</h3>
            </div>
            <div className="space-y-md">
              {(d.strengths || []).map((str, idx) => (
                <div key={idx} className="flex items-center justify-between p-md bg-secondary/5 border border-secondary/20 rounded-xl">
                  <div className="flex items-center gap-md">
                    <div className="w-1.5 h-8 bg-secondary rounded-full"></div>
                    <span className="font-body-md text-body-md font-medium text-on-surface">{str}</span>
                  </div>
                  <span className="font-label-md text-label-md bg-secondary-container text-on-secondary-container px-sm py-1 rounded-full border border-secondary/20">
                    {idx === 0 ? "94% Pos" : "91% Pos"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Weaknesses */}
          <div className="glass-panel p-lg rounded-2xl">
            <div className="flex items-center gap-sm mb-lg">
              <span className="material-symbols-outlined text-error">trending_down</span>
              <h3 className="font-headline-md text-headline-md">Weaknesses</h3>
            </div>
            <div className="space-y-md">
              {(d.weaknesses || []).map((weak, idx) => (
                <div key={idx} className="flex items-center justify-between p-md bg-error/5 border border-error/20 rounded-xl">
                  <div className="flex items-center gap-md">
                    <div className="w-1.5 h-8 bg-error rounded-full"></div>
                    <span className="font-body-md text-body-md font-medium text-on-surface">{weak}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-label-md text-label-md text-error">High Negative Volume</p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">Primarily peak hours</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Product Mentions & Sentiment Breakdown */}
        <div className="glass-panel p-lg rounded-2xl flex flex-col">
          <div className="flex justify-between items-center mb-lg">
            <h3 className="font-headline-md text-headline-md">Product Mentions</h3>
            <span className="font-label-sm text-label-sm text-on-surface-variant">Real-time keyword extraction</span>
          </div>
          <div className="flex-1 space-y-xl">
            {(d.product_mentions || []).map((item, idx) => {
              const percent = item.percent || (92 - idx * 7);
              const isNeutral = item.sentiment?.toLowerCase().includes('neutral');
              return (
                <div key={idx} className="space-y-sm">
                  <div className="flex justify-between items-center">
                    <span className="font-body-md text-body-md font-medium text-on-surface">{item.name}</span>
                    <span className={`font-label-md text-label-md ${isNeutral ? 'text-on-surface-variant' : 'text-secondary'}`}>
                      {item.sentiment}
                    </span>
                  </div>
                  <div className="flex h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full bg-secondary" style={{ width: `${percent}%` }}></div>
                    <div className="h-full bg-error/30" style={{ width: `${100 - percent}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Opportunity Card */}
      <div className="glass-panel p-xl rounded-2xl border-l-4 border-l-primary flex flex-col md:flex-row items-center gap-xl relative overflow-hidden">
        {/* Abstract visual behind */}
        <div className="absolute -right-20 -top-20 opacity-5 pointer-events-none">
          <span className="material-symbols-outlined text-[300px] text-primary">lightbulb</span>
        </div>
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-3xl">insights</span>
        </div>
        <div className="flex-1 text-center md:text-left z-10">
          <h4 className="font-headline-md text-headline-md text-primary mb-xs">Biggest AI Opportunity</h4>
          <p className="font-body-lg text-body-lg text-on-surface">"{d.biggest_opportunity}"</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-xs">AI detected potential rating boost by removing payment friction.</p>
        </div>
        <div className="shrink-0 z-10">
          <button className="bg-primary text-on-primary font-label-md text-label-md px-lg py-3 rounded-xl hover:shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:brightness-110 active:scale-98 transition-all cursor-pointer">
            View Detailed Plan
          </button>
        </div>
      </div>

      {/* Sentiment Velocity Chart */}
      <div className="glass-panel p-lg rounded-2xl">
        <div className="flex justify-between items-center mb-xl">
          <h3 className="font-headline-md text-headline-md">Sentiment Velocity</h3>
          <div className="flex gap-md">
            <div className="flex items-center gap-sm">
              <span className="w-3 h-3 rounded-full bg-secondary"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Positive</span>
            </div>
            <div className="flex items-center gap-sm">
              <span className="w-3 h-3 rounded-full bg-error"></span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">Negative</span>
            </div>
          </div>
        </div>
        <div className="h-48 flex items-end justify-between gap-2 px-md">
          <div className="flex-1 bg-secondary/10 rounded-t-lg transition-all duration-700 hover:bg-secondary/30 group relative" style={{ height: "60%" }}>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity font-label-sm text-label-sm bg-white border border-outline-variant p-1 rounded px-2 shadow-sm">64</div>
          </div>
          <div className="flex-1 bg-secondary/10 rounded-t-lg transition-all duration-700 hover:bg-secondary/30 group relative" style={{ height: "45%" }}></div>
          <div className="flex-1 bg-secondary/10 rounded-t-lg transition-all duration-700 hover:bg-secondary/30 group relative" style={{ height: "75%" }}></div>
          <div className="flex-1 bg-secondary/10 rounded-t-lg transition-all duration-700 hover:bg-secondary/30 group relative" style={{ height: "85%" }}></div>
          <div className="flex-1 bg-secondary/10 rounded-t-lg transition-all duration-700 hover:bg-secondary/30 group relative" style={{ height: "65%" }}></div>
          <div className="flex-1 bg-secondary/10 rounded-t-lg transition-all duration-700 hover:bg-secondary/30 group relative" style={{ height: "90%" }}></div>
          <div className="flex-1 bg-secondary/20 rounded-t-lg transition-all duration-700 hover:bg-secondary/40 group relative" style={{ height: "95%" }}>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-100 font-label-sm text-label-sm bg-white p-1 rounded px-2 border border-secondary/50 shadow-sm font-semibold text-secondary">88%</div>
          </div>
        </div>
        <div className="flex justify-between mt-md px-md">
          <span className="font-label-sm text-label-sm text-on-surface-variant">Week 1</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">Week 2</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">Week 3</span>
          <span className="font-label-sm text-label-sm text-on-surface-variant">Week 4</span>
        </div>
      </div>
    </div>
  );
}
