"use client";

import React, { useState, useEffect } from 'react';

export default function HistoryTab({ activeBusiness, token, onPacingUpdated }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [draftTexts, setDraftTexts] = useState({});
  const [copiedId, setCopiedId] = useState(null); // 'type-id'

  const limit = 10;

  const fetchHistory = async (targetPage) => {
    if (!activeBusiness) return;
    setLoading(true);
    setError('');
    const offset = targetPage * limit;

    try {
      const response = await fetch(
        `/api/v1/businesses/${activeBusiness.id}/history?limit=${limit}&offset=${offset}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const data = await response.json();
      setLoading(false);

      if (data.error) {
        setError(data.message || 'Failed to load history');
        return;
      }

      const historyData = data.history || [];
      onPacingUpdated(data.pacing_warning, data.daily_count);

      if (historyData.length === 0 && targetPage > 0) {
        // Backtrack page if it returns empty
        setPage(targetPage - 1);
        fetchHistory(targetPage - 1);
        return;
      }

      setHistory(historyData);
      setHasMore(historyData.length === limit);

      // Initialize text editing map
      const texts = {};
      historyData.forEach((item) => {
        texts[`${item.type}-${item.id}`] = item.selected_text;
      });
      setDraftTexts((prev) => ({ ...prev, ...texts }));
    } catch (err) {
      setLoading(false);
      setError('Connection failed while retrieving history logbook.');
    }
  };

  useEffect(() => {
    setPage(0);
    fetchHistory(0);
  }, [activeBusiness]);

  const handleTextChange = (key, val) => {
    setDraftTexts((prev) => ({
      ...prev,
      [key]: val
    }));
  };

  const handleStatusChange = async (item, newStatus) => {
    try {
      const response = await fetch(`/api/v1/history/${item.type}/${item.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await response.json();
      if (data.error) {
        alert('Failed to update status: ' + data.message);
        return;
      }

      // Update local item status
      setHistory((prev) =>
        prev.map((h) => (h.id === item.id && h.type === item.type ? { ...h, status: newStatus } : h))
      );
    } catch (err) {
      alert('Failed to sync status due to network error.');
    }
  };

  const handleSaveAndCopy = async (item) => {
    const key = `${item.type}-${item.id}`;
    const textVal = draftTexts[key] || '';

    try {
      // 1. Save text
      const textResponse = await fetch(`/api/v1/history/${item.type}/${item.id}/text`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: textVal })
      });

      const textData = await textResponse.json();
      if (textData.error) {
        alert('Failed to save edit: ' + textData.message);
        return;
      }

      // 2. Auto-advance status if drafted
      let nextStatus = item.status;
      if (item.status === 'drafted') {
        nextStatus = 'edited';
        await fetch(`/api/v1/history/${item.type}/${item.id}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ status: nextStatus })
        });
      }

      // 3. Copy to clipboard
      await navigator.clipboard.writeText(textVal);

      // 4. Update UI
      setHistory((prev) =>
        prev.map((h) => (h.id === item.id && h.type === item.type ? { ...h, status: nextStatus, selected_text: textVal } : h))
      );

      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      alert('Saved, but failed to write to clipboard.');
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm('Are you sure you want to permanently delete this entry from the desk log?')) {
      return;
    }

    try {
      const response = await fetch(`/api/v1/history/${item.type}/${item.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.error) {
        alert('Failed to delete: ' + data.message);
        return;
      }

      // Reload current page
      fetchHistory(page);
    } catch (err) {
      alert('Connection failure during deletion.');
    }
  };

  const handlePagination = (direction) => {
    const nextPage = page + direction;
    if (nextPage < 0) return;
    setPage(nextPage);
    fetchHistory(nextPage);
  };

  return (
    <div className="card history-card">
      <div className="history-header">
        <div>
          <h3>Correspondence History Log</h3>
          <p className="history-sub">View, edit, and update the status of past replies and review generations</p>
        </div>
        <div className="history-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => fetchHistory(page)}>
            ↺ Refresh
          </button>
        </div>
      </div>

      {loading && (
        <div id="history-loading" className="spinner-overlay">
          <div className="spinner"></div>
          <p>Opening history logbook...</p>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {!loading && history.length === 0 && (
        <div id="history-empty" className="empty-state">
          <div className="empty-state-icon">📂</div>
          <h2>No History Yet</h2>
          <p>Generations for this business profile will be tracked and stored here.</p>
        </div>
      )}

      {!loading && history.length > 0 && (
        <>
          <div id="history-list" className="history-list">
            {history.map((item) => {
              const key = `${item.type}-${item.id}`;
              const dateStr = new Date(item.created_at).toLocaleString();
              const stars = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);
              const textVal = draftTexts[key] !== undefined ? draftTexts[key] : item.selected_text;

              return (
                <div key={key} className="history-item">
                  <div className="history-item-header">
                    <div className="history-meta-left">
                      <span className={`history-flow-badge flow-${item.type}`}>
                        {item.type === 'reply' ? 'Reply Draft' : 'Customer Review'}
                      </span>
                      <span className="history-stars">{stars}</span>
                      <span className="history-date">{dateStr}</span>
                    </div>
                    <div className="history-meta-right">
                      <span className={`badge badge-${item.status}`}>{item.status}</span>
                    </div>
                  </div>
                  <div className="history-details">
                    {/* Left details pane */}
                    {item.type === 'reply' ? (
                      <div className="history-source-box">
                        <span className="source-label">Reviewer: {item.customer_name}</span>
                        <p className="source-content">"{item.review_text}"</p>
                      </div>
                    ) : (
                      <div className="history-source-box">
                        <span className="source-label">Liked details</span>
                        <p className="source-content" style={{ marginBottom: '6px' }}>
                          {item.liked}
                        </p>
                        {item.disliked && (
                          <>
                            <span className="source-label">Disliked details</span>
                            <p className="source-content">{item.disliked}</p>
                          </>
                        )}
                      </div>
                    )}

                    {/* Right editor pane */}
                    <div className="history-editor-box">
                      <span className="source-label">
                        {item.type === 'reply' ? 'Draft Reply Text' : 'Draft Review Text'}
                      </span>
                      <textarea
                        rows="4"
                        value={textVal}
                        onChange={(e) => handleTextChange(key, e.target.value)}
                      />
                      <div className="editor-actions">
                        <div className="editor-status-select">
                          <label htmlFor={`status-select-${key}`}>Status:</label>
                          <div className="select-wrapper" style={{ width: '120px' }}>
                            <select
                              id={`status-select-${key}`}
                              value={item.status}
                              onChange={(e) => handleStatusChange(item, e.target.value)}
                            >
                              <option value="drafted">Drafted</option>
                              <option value="edited">Edited</option>
                              <option value="posted">Posted</option>
                            </select>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {activeBusiness?.google_review_link ? (
                            <a
                              href={activeBusiness.google_review_link}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary btn-sm"
                              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              {item.type === 'reply' ? '🔗 Go to Reviews' : '🔗 Review Link'}
                            </a>
                          ) : null}
                          <button className="btn btn-secondary btn-sm" onClick={() => handleDelete(item)}>
                            Delete
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSaveAndCopy(item)}
                            style={copiedId === key ? { backgroundColor: '#1D4ED8' } : {}}
                          >
                            {copiedId === key ? '✓ Saved & Copied!' : 'Save & Copy'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div id="history-pagination" className="history-pagination">
            <button
              className="btn btn-secondary btn-sm"
              disabled={page === 0}
              onClick={() => handlePagination(-1)}
            >
              &larr; Newer Entries
            </button>
            <span id="page-indicator">Page {page + 1}</span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={!hasMore}
              onClick={() => handlePagination(1)}
            >
              Older Entries &rarr;
            </button>
          </div>
        </>
      )}
    </div>
  );
}
