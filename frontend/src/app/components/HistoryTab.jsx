"use client";

import React, { useState, useEffect } from 'react';

export default function HistoryTab({ activeBusiness, token, onPacingUpdated }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [draftTexts, setDraftTexts] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const limit = 10;

  const fetchHistory = async (targetPage) => {
    if (!activeBusiness) return;
    setLoading(true); setError('');
    const offset = targetPage * limit;
    try {
      const response = await fetch(`/api/v1/businesses/${activeBusiness.id}/history?limit=${limit}&offset=${offset}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setLoading(false);
      if (data.error) { setError(data.message || 'Failed to load history'); return; }
      const historyData = data.history || [];
      onPacingUpdated(data.pacing_warning, data.daily_count);
      if (historyData.length === 0 && targetPage > 0) { setPage(targetPage - 1); fetchHistory(targetPage - 1); return; }
      setHistory(historyData);
      setHasMore(historyData.length === limit);
      const texts = {};
      historyData.forEach((item) => { texts[`${item.type}-${item.id}`] = item.selected_text; });
      setDraftTexts((prev) => ({ ...prev, ...texts }));
    } catch (err) {
      setLoading(false);
      setError('Connection failed.');
    }
  };

  useEffect(() => { setPage(0); fetchHistory(0); }, [activeBusiness]);

  const handleTextChange = (key, val) => setDraftTexts((prev) => ({ ...prev, [key]: val }));

  const handleStatusChange = async (item, newStatus) => {
    try {
      const response = await fetch(`/api/v1/history/${item.type}/${item.id}/status`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (data.error) { alert('Failed to update status'); return; }
      setHistory((prev) => prev.map((h) => (h.id === item.id && h.type === item.type ? { ...h, status: newStatus } : h)));
    } catch (err) { alert('Network error.'); }
  };

  const handleSaveAndCopy = async (item) => {
    const key = `${item.type}-${item.id}`;
    const textVal = draftTexts[key] || '';
    try {
      const textResponse = await fetch(`/api/v1/history/${item.type}/${item.id}/text`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text: textVal })
      });
      const textData = await textResponse.json();
      if (textData.error) { alert('Failed to save'); return; }
      let nextStatus = item.status;
      if (item.status === 'drafted') {
        nextStatus = 'edited';
        await fetch(`/api/v1/history/${item.type}/${item.id}/status`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ status: nextStatus })
        });
      }
      await navigator.clipboard.writeText(textVal);
      setHistory((prev) => prev.map((h) => (h.id === item.id && h.type === item.type ? { ...h, status: nextStatus, selected_text: textVal } : h)));
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) { alert('Saved, but clipboard failed.'); }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Delete this entry permanently?')) return;
    try {
      const response = await fetch(`/api/v1/history/${item.type}/${item.id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.error) { alert('Failed to delete'); return; }
      fetchHistory(page);
    } catch (err) { alert('Delete failed.'); }
  };

  const handlePagination = (dir) => {
    const next = page + dir;
    if (next < 0) return;
    setPage(next);
    fetchHistory(next);
  };

  const statusColors = {
    drafted: 'bg-amber-50 text-amber-700 border-amber-200',
    edited: 'bg-blue-50 text-blue-700 border-blue-200',
    posted: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  };

  return (
    <div className="bg-white border border-[var(--c-d7e3fc)] rounded-xl p-5 shadow-xs">
      {/* Header */}
      <div className="flex justify-between items-center mb-5 pb-3 border-b border-[var(--c-e2eafc)]">
        <div>
          <h3 className="text-sm font-bold">History Log</h3>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">View and manage past generated drafts</p>
        </div>
        <button className="btn btn-secondary text-xs px-3 py-1.5" onClick={() => fetchHistory(page)}>
          <span className="material-symbols-outlined text-[14px]">refresh</span> Refresh
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <span className="material-symbols-outlined text-3xl animate-spin text-[var(--accent)]">sync</span>
          <p className="text-xs text-[var(--text-muted)] mt-2">Loading history...</p>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-xs mb-4">{error}</div>}

      {!loading && history.length === 0 && (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-[var(--bg-muted)] flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-[var(--text-muted)] text-2xl">folder_open</span>
          </div>
          <h4 className="text-sm font-bold mb-1">No History Yet</h4>
          <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto">Generations will appear here.</p>
        </div>
      )}

      {!loading && history.length > 0 && (
        <div className="space-y-4">
          {history.map((item) => {
            const key = `${item.type}-${item.id}`;
            const dateStr = new Date(item.created_at).toLocaleString();
            const stars = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);
            const textVal = draftTexts[key] !== undefined ? draftTexts[key] : item.selected_text;
            const statusClass = statusColors[item.status] || 'bg-slate-50 text-slate-600 border-slate-200';

            return (
              <div key={key} className="border border-[var(--c-d7e3fc)] rounded-xl p-4 bg-[var(--bg-muted)] space-y-3">
                {/* Meta */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[var(--c-e2eafc)]">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] border ${
                      item.type === 'reply' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-pink-50 text-pink-700 border-pink-200'
                    }`}>
                      {item.type === 'reply' ? 'Reply' : 'Review'}
                    </span>
                    <span className="text-[var(--gold)] text-sm">{stars}</span>
                    <span className="text-[var(--text-muted)]">{dateStr}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${statusClass}`}>
                    {item.status}
                  </span>
                </div>

                {/* Content */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Source */}
                  <div className="bg-white p-3.5 rounded-lg border border-[var(--c-e2eafc)] space-y-1.5">
                    {item.type === 'reply' ? (
                      <>
                        <span className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Reviewer: {item.customer_name}</span>
                        <p className="text-xs italic leading-relaxed">"{item.review_text}"</p>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <span className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Liked</span>
                          <p className="text-xs leading-relaxed">{item.liked}</p>
                        </div>
                        {item.disliked && (
                          <div>
                            <span className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Disliked</span>
                            <p className="text-xs leading-relaxed">{item.disliked}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Editor */}
                  <div className="space-y-2.5">
                    <span className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      {item.type === 'reply' ? 'Draft Reply' : 'Draft Review'}
                    </span>
                    <textarea
                      rows="3"
                      value={textVal}
                      onChange={(e) => handleTextChange(key, e.target.value)}
                      className="w-full text-sm px-3 py-2 border border-[var(--c-ccdbfd)] rounded-lg outline-none focus:border-[var(--accent)] bg-white resize-none"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={item.status}
                          onChange={(e) => handleStatusChange(item, e.target.value)}
                          className="bg-white border border-[var(--c-ccdbfd)] text-[11px] font-medium rounded-md px-2 py-1 outline-none cursor-pointer"
                        >
                          <option value="drafted">Drafted</option>
                          <option value="edited">Edited</option>
                          <option value="posted">Posted</option>
                        </select>
                      </div>
                      <div className="flex gap-1.5">
                        <button className="btn btn-secondary text-xs px-2 py-1 text-red-500" onClick={() => handleDelete(item)}>Delete</button>
                        <button
                          className={`btn text-xs px-3 py-1 ${copiedId === key ? 'bg-emerald-600 text-white' : 'btn-primary'}`}
                          onClick={() => handleSaveAndCopy(item)}
                        >
                          {copiedId === key ? '✓ Done!' : 'Save & Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--c-e2eafc)]">
            <button className="btn btn-secondary text-xs px-3 py-1.5 disabled:opacity-40" disabled={page === 0} onClick={() => handlePagination(-1)}>
              ← Newer
            </button>
            <span className="text-xs font-semibold text-[var(--text-muted)]">Page {page + 1}</span>
            <button className="btn btn-secondary text-xs px-3 py-1.5 disabled:opacity-40" disabled={!hasMore} onClick={() => handlePagination(1)}>
              Older →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
