/* app.js
   Reply Desk — Single Page Application Frontend Client */

const API_BASE = '/api/v1';

// Application State
const state = {
    token: localStorage.getItem('token') || null,
    user: null,
    businesses: [],
    activeBusinessId: localStorage.getItem('activeBusinessId') ? parseInt(localStorage.getItem('activeBusinessId')) : null,
    activeTab: 'tab-reply',
    history: [],
    historyPage: 0,
    historyLimit: 10,
    hasMoreHistory: true
};

// Document Elements
const el = {
    app: document.getElementById('app'),
    authView: document.getElementById('auth-view'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    showRegister: document.getElementById('show-register'),
    showLogin: document.getElementById('show-login'),
    authError: document.getElementById('auth-error'),
    
    workspace: document.getElementById('workspace'),
    userEmail: document.getElementById('user-display-email'),
    btnLogout: document.getElementById('btn-logout'),
    
    businessSelect: document.getElementById('business-select'),
    btnNewBusiness: document.getElementById('btn-new-business'),
    businessModal: document.getElementById('business-modal'),
    businessForm: document.getElementById('business-form'),
    businessIdInput: document.getElementById('business-id-input'),
    businessReviewLinkInput: document.getElementById('business-review-link'),
    btnCancelBusiness: document.getElementById('btn-cancel-business'),
    btnCloseBusinessModal: document.getElementById('btn-close-business-modal'),
    
    pacingRibbon: document.getElementById('pacing-ribbon'),
    pacingMessage: document.getElementById('pacing-message'),
    ribbonCount: document.getElementById('ribbon-count'),
    
    noBusinessOverlay: document.getElementById('no-business-overlay'),
    workspaceContent: document.getElementById('workspace-content'),
    btnEmptyCreateBusiness: document.getElementById('btn-empty-create-business'),
    
    tabs: document.querySelectorAll('.desk-tab'),
    tabReply: document.getElementById('tab-reply'),
    tabReview: document.getElementById('tab-review'),
    tabHistory: document.getElementById('tab-history'),
    
    // Reply Flow Elements
    replyForm: document.getElementById('reply-generator-form'),
    replyStarPicker: document.getElementById('reply-star-picker'),
    replyRatingValue: document.getElementById('reply-rating-value'),
    replyLoading: document.getElementById('reply-loading'),
    replyPlaceholder: document.getElementById('reply-placeholder'),
    replyVariants: document.getElementById('reply-variants-container'),
    replyError: document.getElementById('reply-error'),
    
    // Review Flow Elements
    reviewForm: document.getElementById('review-generator-form'),
    reviewStarPicker: document.getElementById('review-star-picker'),
    reviewRatingValue: document.getElementById('review-rating-value'),
    reviewLoading: document.getElementById('review-loading'),
    reviewPlaceholder: document.getElementById('review-placeholder'),
    reviewVariants: document.getElementById('review-variants-container'),
    reviewError: document.getElementById('review-error'),
    
    // History Elements
    historyList: document.getElementById('history-list'),
    historyLoading: document.getElementById('history-loading'),
    historyError: document.getElementById('history-error'),
    historyEmpty: document.getElementById('history-empty'),
    historyPagination: document.getElementById('history-pagination'),
    btnPrevPage: document.getElementById('btn-prev-page'),
    btnNextPage: document.getElementById('btn-next-page'),
    pageIndicator: document.getElementById('page-indicator'),
    btnRefreshHistory: document.getElementById('btn-refresh-history')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initAuth();
});

// Setup Event Listeners
function setupEventListeners() {
    // Auth Toggles
    el.showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        el.loginForm.classList.add('hidden');
        el.registerForm.classList.remove('hidden');
        el.authError.classList.add('hidden');
    });
    
    el.showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        el.registerForm.classList.add('hidden');
        el.loginForm.classList.remove('hidden');
        el.authError.classList.add('hidden');
    });

    // Auth Submit
    el.loginForm.addEventListener('submit', handleLogin);
    el.registerForm.addEventListener('submit', handleRegister);
    el.btnLogout.addEventListener('click', handleLogout);

    // Business Modal
    el.btnNewBusiness.addEventListener('click', () => showBusinessModal());
    el.btnEmptyCreateBusiness.addEventListener('click', () => showBusinessModal());
    el.btnCancelBusiness.addEventListener('click', closeBusinessModal);
    el.btnCloseBusinessModal.addEventListener('click', closeBusinessModal);
    el.businessForm.addEventListener('submit', handleBusinessSubmit);
    el.businessSelect.addEventListener('change', handleBusinessChange);

    // Folder Tabs
    el.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTabId = tab.getAttribute('data-tab');
            switchTab(targetTabId);
        });
    });

    // Interactive Star Rating Pickers
    setupStarPicker(el.replyStarPicker, el.replyRatingValue);
    setupStarPicker(el.reviewStarPicker, el.reviewRatingValue);

    // Generation Forms
    el.replyForm.addEventListener('submit', handleReplyGenerate);
    el.reviewForm.addEventListener('submit', handleReviewGenerate);

    // History controls
    el.btnRefreshHistory.addEventListener('click', () => fetchHistory(state.activeBusinessId));
    el.btnPrevPage.addEventListener('click', () => navigateHistoryPage(-1));
    el.btnNextPage.addEventListener('click', () => navigateHistoryPage(1));
}

// Authentication Helpers
function initAuth() {
    if (state.token) {
        // Parse email from token if possible (payload is 2nd part of JWT)
        try {
            const payload = JSON.parse(atob(state.token.split('.')[1]));
            // Fetch profile
            el.userEmail.textContent = payload.email || 'Business Owner';
            showWorkspace();
        } catch (e) {
            handleLogout();
        }
    } else {
        showAuth();
    }
}

function showAuth() {
    el.authView.classList.remove('hidden');
    el.workspace.classList.add('hidden');
}

function showWorkspace() {
    el.authView.classList.add('hidden');
    el.workspace.classList.remove('hidden');
    fetchBusinesses();
}

async function handleLogin(e) {
    e.preventDefault();
    el.authError.classList.add('hidden');
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const res = await apiRequest('/auth/login', 'POST', { email, password });
        if (res.error) {
            showError(el.authError, res.message || 'Login failed');
            return;
        }
        
        state.token = res.token;
        localStorage.setItem('token', res.token);
        el.userEmail.textContent = res.user.email;
        showWorkspace();
        
        // Reset form
        el.loginForm.reset();
    } catch (err) {
        showError(el.authError, 'Connection failed. Please check if server is running.');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    el.authError.classList.add('hidden');
    
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const res = await apiRequest('/auth/register', 'POST', { email, password });
        if (res.error) {
            showError(el.authError, res.message || 'Registration failed');
            return;
        }
        
        state.token = res.token;
        localStorage.setItem('token', res.token);
        el.userEmail.textContent = res.user.email;
        showWorkspace();
        
        // Reset form
        el.registerForm.reset();
    } catch (err) {
        showError(el.authError, 'Connection failed. Please check if server is running.');
    }
}

function handleLogout() {
    state.token = null;
    state.user = null;
    state.businesses = [];
    state.activeBusinessId = null;
    localStorage.removeItem('token');
    localStorage.removeItem('activeBusinessId');
    showAuth();
}

// Business Management Helpers
async function fetchBusinesses() {
    try {
        const businesses = await apiRequest('/businesses', 'GET');
        if (businesses.error) {
            console.error('Failed to fetch businesses:', businesses.message);
            return;
        }
        
        state.businesses = businesses || [];
        renderBusinessDropdown();
        
        if (state.businesses.length > 0) {
            // Restore previous or pick first
            let toSelect = state.businesses[0].id;
            if (state.activeBusinessId && state.businesses.some(b => b.id === state.activeBusinessId)) {
                toSelect = state.activeBusinessId;
            }
            selectBusiness(toSelect);
        } else {
            showNoBusinessState();
        }
    } catch (err) {
        console.error('Error fetching businesses:', err);
    }
}

function renderBusinessDropdown() {
    el.businessSelect.innerHTML = '<option value="">-- Select a Business --</option>';
    state.businesses.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.name} (${b.category})`;
        el.businessSelect.appendChild(opt);
    });
}

function selectBusiness(id) {
    state.activeBusinessId = id;
    localStorage.setItem('activeBusinessId', id);
    el.businessSelect.value = id;
    
    if (id) {
        el.noBusinessOverlay.classList.add('hidden');
        el.workspaceContent.classList.remove('hidden');
        
        // Load default tone settings if form tone not set
        const activeBiz = state.businesses.find(b => b.id === id);
        if (activeBiz) {
            document.getElementById('reply-tone').value = activeBiz.tone_default;
            document.getElementById('review-tone').value = activeBiz.tone_default;
        }
        
        // Fetch history immediately to update statistics and pacing
        fetchHistory(id);
    } else {
        showNoBusinessState();
    }
}

function showNoBusinessState() {
    el.noBusinessOverlay.classList.remove('hidden');
    el.workspaceContent.classList.add('hidden');
    el.pacingRibbon.classList.add('hidden');
}

function handleBusinessChange(e) {
    const val = e.target.value;
    selectBusiness(val ? parseInt(val) : null);
}

function showBusinessModal() {
    el.businessForm.reset();
    el.businessIdInput.value = '';
    el.businessReviewLinkInput.value = '';
    el.businessModal.classList.remove('hidden');
}

function closeBusinessModal() {
    el.businessModal.classList.add('hidden');
}

async function handleBusinessSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('business-name').value;
    const category = document.getElementById('business-category').value;
    const tone_default = document.getElementById('business-tone').value;
    const google_review_link = el.businessReviewLinkInput.value;
    
    try {
        const res = await apiRequest('/businesses', 'POST', { name, category, tone_default, google_review_link });
        if (res.error) {
            alert('Failed to save business profile: ' + res.message);
            return;
        }
        
        closeBusinessModal();
        await fetchBusinesses();
        selectBusiness(res.id);
    } catch (err) {
        alert('Failed to save business due to network error.');
    }
}

// Tab Navigation Helpers
function switchTab(tabId) {
    state.activeTab = tabId;
    
    // Update active class on tab buttons
    el.tabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === tabId) {
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
        } else {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
        }
    });

    // Toggle tab sections
    el.tabReply.classList.add('hidden');
    el.tabReview.classList.add('hidden');
    el.tabHistory.classList.add('hidden');

    if (tabId === 'tab-reply') {
        el.tabReply.classList.remove('hidden');
    } else if (tabId === 'tab-review') {
        el.tabReview.classList.remove('hidden');
    } else if (tabId === 'tab-history') {
        el.tabHistory.classList.remove('hidden');
        state.historyPage = 0;
        fetchHistory(state.activeBusinessId);
    }
}

// Interactive Star Picker
function setupStarPicker(pickerEl, hiddenInput) {
    const stars = pickerEl.querySelectorAll('.star-picker-icon');
    
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const val = parseInt(star.getAttribute('data-value'));
            hiddenInput.value = val;
            
            // Set active class on clicked star and its predecessors
            stars.forEach(s => {
                const sVal = parseInt(s.getAttribute('data-value'));
                if (sVal <= val) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        });
    });

    // Trigger initial set (default 5 stars)
    const initialVal = parseInt(hiddenInput.value);
    stars.forEach(s => {
        if (parseInt(s.getAttribute('data-value')) <= initialVal) {
            s.classList.add('active');
        }
    });
}

// Reply Generator Submission
async function handleReplyGenerate(e) {
    e.preventDefault();
    
    el.replyError.classList.add('hidden');
    el.replyPlaceholder.classList.add('hidden');
    el.replyVariants.classList.add('hidden');
    el.replyLoading.classList.remove('hidden');
    
    const customer_name = document.getElementById('reply-customer').value;
    const rating = parseInt(el.replyRatingValue.value);
    const review_text = document.getElementById('reply-text').value;
    const tone = document.getElementById('reply-tone').value;
    const context = document.getElementById('reply-context').value;
    const business_id = state.activeBusinessId;

    try {
        const res = await apiRequest('/replies/generate', 'POST', {
            business_id, customer_name, rating, review_text, tone, context
        });
        
        el.replyLoading.classList.add('hidden');
        
        if (res.error) {
            showError(el.replyError, res.message || 'Generation failed');
            el.replyPlaceholder.classList.remove('hidden');
            return;
        }

        renderVariants(el.replyVariants, res.variants, 'reply', res.id);
        el.replyVariants.classList.remove('hidden');
        
        // Refresh pacing and daily stats
        updatePacingRibbon(res.pacing_warning, res.daily_count);
        
    } catch (err) {
        el.replyLoading.classList.add('hidden');
        showError(el.replyError, 'Failed to connect to generation service. Please check your network.');
        el.replyPlaceholder.classList.remove('hidden');
    }
}

// Review Generator Submission
async function handleReviewGenerate(e) {
    e.preventDefault();
    
    el.reviewError.classList.add('hidden');
    el.reviewPlaceholder.classList.add('hidden');
    el.reviewVariants.classList.add('hidden');
    el.reviewLoading.classList.remove('hidden');
    
    const rating = parseInt(el.reviewRatingValue.value);
    const liked = document.getElementById('review-liked').value;
    const disliked = document.getElementById('review-disliked').value;
    const tone = document.getElementById('review-tone').value;
    const business_id = state.activeBusinessId;

    try {
        const res = await apiRequest('/reviews/generate', 'POST', {
            business_id, rating, liked, disliked, tone
        });
        
        el.reviewLoading.classList.add('hidden');
        
        if (res.error) {
            showError(el.reviewError, res.message || 'Generation failed');
            el.reviewPlaceholder.classList.remove('hidden');
            return;
        }

        renderVariants(el.reviewVariants, res.variants, 'review', res.id);
        el.reviewVariants.classList.remove('hidden');
        
        // Refresh pacing
        updatePacingRibbon(res.pacing_warning, res.daily_count);
        
    } catch (err) {
        el.reviewLoading.classList.add('hidden');
        showError(el.reviewError, 'Failed to connect to generation service. Please check your network.');
        el.reviewPlaceholder.classList.remove('hidden');
    }
}

// Render generated variants list
function renderVariants(containerEl, variants, flowType, dbRecordId) {
    containerEl.innerHTML = '';
    
    const activeBiz = state.businesses.find(b => b.id === state.activeBusinessId);
    const googleReviewLink = activeBiz ? activeBiz.google_review_link : '';
    
    variants.forEach((v, index) => {
        const card = document.createElement('div');
        card.className = 'variant-card';
        
        const wordCount = v.text.split(/\s+/).filter(w => w.length > 0).length;
        
        let actionButtonsHTML = '';
        if (googleReviewLink) {
            const btnLabel = flowType === 'reply' ? '🔗 Go to Google Reviews' : '🔗 Customer Review Link';
            actionButtonsHTML = `
                <a href="${googleReviewLink}" target="_blank" class="btn btn-secondary btn-sm" style="margin-right: 8px; text-decoration: none;">
                    ${btnLabel}
                </a>
            `;
        } else {
            actionButtonsHTML = `
                <span style="font-size: 11px; color: var(--color-ink-medium); margin-right: auto; align-self: center;">
                    ⚠️ No review link saved.
                </span>
            `;
        }
        
        card.innerHTML = `
            <div class="variant-meta">
                <span class="variant-label">${v.label || `Option ${index + 1}`}</span>
                <span class="variant-word-count">${wordCount} words</span>
            </div>
            <div class="variant-text" id="variant-text-${flowType}-${index}">${escapeHtml(v.text)}</div>
            <div class="variant-actions" style="display: flex; justify-content: flex-end; align-items: center; width: 100%;">
                ${actionButtonsHTML}
                <button class="btn btn-primary btn-sm btn-copy-variant" data-flow="${flowType}" data-idx="${index}" data-id="${dbRecordId}">
                    Select & Copy
                </button>
            </div>
        `;
        
        containerEl.appendChild(card);
    });

    // Add Copy Event Listeners
    containerEl.querySelectorAll('.btn-copy-variant').forEach(btn => {
        btn.addEventListener('click', async () => {
            const flow = btn.getAttribute('data-flow');
            const idx = btn.getAttribute('data-idx');
            const recordId = btn.getAttribute('data-id');
            const textElement = document.getElementById(`variant-text-${flow}-${idx}`);
            const textToCopy = textElement.textContent;
            
            // 1. Copy to clipboard
            try {
                await navigator.clipboard.writeText(textToCopy);
                
                // Visual feedback micro-animation
                const originalText = btn.textContent;
                btn.textContent = '✓ Copied!';
                btn.style.backgroundColor = '#1D4ED8'; // Blue color transition
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.backgroundColor = '';
                }, 2000);
            } catch (err) {
                alert('Could not copy to clipboard. Please copy text manually.');
            }

            // 2. Update text and mark status in DB history to reflect the chosen option
            try {
                // Update the text to match the selected variant
                await apiRequest(`/history/${flow}/${recordId}/text`, 'PUT', { text: textToCopy });
                // Update the status to 'posted'
                await apiRequest(`/history/${flow}/${recordId}/status`, 'PUT', { status: 'posted' });
            } catch (err) {
                console.error('Failed to update chosen variant in DB:', err);
            }
        });
    });
}

// Fetch and Render History Feed
async function fetchHistory(businessId) {
    if (!businessId) return;
    
    // Hide list and empty, show loader
    el.historyList.classList.add('hidden');
    el.historyEmpty.classList.add('hidden');
    el.historyPagination.classList.add('hidden');
    el.historyLoading.classList.remove('hidden');
    el.historyError.classList.add('hidden');

    const offset = state.historyPage * state.historyLimit;
    
    try {
        const res = await apiRequest(`/businesses/${businessId}/history?limit=${state.historyLimit}&offset=${offset}`, 'GET');
        
        el.historyLoading.classList.add('hidden');
        
        if (res.error) {
            showError(el.historyError, res.message || 'Failed to load history');
            return;
        }

        state.history = res.history || [];
        updatePacingRibbon(res.pacing_warning, res.daily_count);
        
        if (state.history.length === 0) {
            if (state.historyPage > 0) {
                // Backtrack if page empty
                state.historyPage--;
                fetchHistory(businessId);
            } else {
                el.historyEmpty.classList.remove('hidden');
            }
            return;
        }

        renderHistoryList();
        el.historyList.classList.remove('hidden');
        
        // Handle pagination display
        el.historyPagination.classList.remove('hidden');
        el.pageIndicator.textContent = `Page ${state.historyPage + 1}`;
        el.btnPrevPage.disabled = state.historyPage === 0;
        
        // If length returned is less than limit, we don't have a next page
        state.hasMoreHistory = state.history.length === state.historyLimit;
        el.btnNextPage.disabled = !state.hasMoreHistory;

    } catch (err) {
        el.historyLoading.classList.add('hidden');
        showError(el.historyError, 'Connection failed while retrieving history logbook.');
    }
}

function renderHistoryList() {
    el.historyList.innerHTML = '';
    
    const activeBiz = state.businesses.find(b => b.id === state.activeBusinessId);
    const googleReviewLink = activeBiz ? activeBiz.google_review_link : '';
    
    state.history.forEach(item => {
        const card = document.createElement('div');
        card.className = 'history-item';
        
        const dateStr = new Date(item.created_at).toLocaleString();
        const starHTML = '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating);
        
        let leftDetailsHTML = '';
        if (item.type === 'reply') {
            leftDetailsHTML = `
                <div class="history-source-box">
                    <span class="source-label">Reviewer: ${escapeHtml(item.customer_name)}</span>
                    <p class="source-content">"${escapeHtml(item.review_text)}"</p>
                </div>
            `;
        } else {
            leftDetailsHTML = `
                <div class="history-source-box">
                    <span class="source-label">Liked details</span>
                    <p class="source-content" style="margin-bottom:6px;">${escapeHtml(item.liked)}</p>
                    ${item.disliked ? `<span class="source-label">Disliked details</span><p class="source-content">${escapeHtml(item.disliked)}</p>` : ''}
                </div>
            `;
        }
        
        const badgeClass = `badge-${item.status}`;
        
        let linkHTML = '';
        if (googleReviewLink) {
            const linkLabel = item.type === 'reply' ? '🔗 Go to Reviews' : '🔗 Review Link';
            linkHTML = `
                <a href="${googleReviewLink}" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">
                    ${linkLabel}
                </a>
            `;
        }
        
        card.innerHTML = `
            <div class="history-item-header">
                <div class="history-meta-left">
                    <span class="history-flow-badge flow-${item.type}">
                        ${item.type === 'reply' ? 'Reply Draft' : 'Customer Review'}
                    </span>
                    <span class="history-stars">${starHTML}</span>
                    <span class="history-date">${dateStr}</span>
                </div>
                <div class="history-meta-right">
                    <span id="badge-status-${item.type}-${item.id}" class="badge ${badgeClass}">${item.status}</span>
                </div>
            </div>
            <div class="history-details">
                ${leftDetailsHTML}
                <div class="history-editor-box">
                    <span class="source-label">${item.type === 'reply' ? 'Draft Reply Text' : 'Draft Review Text'}</span>
                    <textarea id="text-edit-${item.type}-${item.id}" rows="4">${escapeHtml(item.selected_text)}</textarea>
                    <div class="editor-actions">
                        <div class="editor-status-select">
                            <label for="status-select-${item.type}-${item.id}">Status:</label>
                            <div class="select-wrapper" style="width: 120px;">
                                <select id="status-select-${item.type}-${item.id}" data-type="${item.type}" data-id="${item.id}" class="select-history-status">
                                    <option value="drafted" ${item.status === 'drafted' ? 'selected' : ''}>Drafted</option>
                                    <option value="edited" ${item.status === 'edited' ? 'selected' : ''}>Edited</option>
                                    <option value="posted" ${item.status === 'posted' ? 'selected' : ''}>Posted</option>
                                </select>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
                            ${linkHTML}
                            <button class="btn btn-secondary btn-sm btn-delete-history" data-type="${item.type}" data-id="${item.id}">Delete</button>
                            <button class="btn btn-primary btn-sm btn-save-history" data-type="${item.type}" data-id="${item.id}">Save & Copy</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        el.historyList.appendChild(card);
    });

    // Add Event Listeners for inline items
    el.historyList.querySelectorAll('.select-history-status').forEach(select => {
        select.addEventListener('change', async (e) => {
            const flow = select.getAttribute('data-type');
            const id = select.getAttribute('data-id');
            const newStatus = select.value;
            
            try {
                const res = await apiRequest(`/history/${flow}/${id}/status`, 'PUT', { status: newStatus });
                if (!res.error) {
                    // Update badge immediately
                    const badge = document.getElementById(`badge-status-${flow}-${id}`);
                    badge.className = `badge badge-${newStatus}`;
                    badge.textContent = newStatus;
                } else {
                    alert('Failed to update status: ' + res.message);
                }
            } catch (err) {
                alert('Failed to sync status due to network error.');
            }
        });
    });

    el.historyList.querySelectorAll('.btn-save-history').forEach(btn => {
        btn.addEventListener('click', async () => {
            const flow = btn.getAttribute('data-type');
            const id = btn.getAttribute('data-id');
            const textarea = document.getElementById(`text-edit-${flow}-${id}`);
            const textVal = textarea.value;
            
            try {
                // 1. Save text
                let res = await apiRequest(`/history/${flow}/${id}/text`, 'PUT', { text: textVal });
                if (res.error) {
                    alert('Failed to save edit: ' + res.message);
                    return;
                }
                
                // 2. Set status to 'edited' (or 'posted' when copying - let's set to 'edited' since they clicked save)
                let statusSelect = document.getElementById(`status-select-${flow}-${id}`);
                const currentStatus = statusSelect.value;
                let nextStatus = currentStatus === 'drafted' ? 'edited' : currentStatus;
                
                await apiRequest(`/history/${flow}/${id}/status`, 'PUT', { status: nextStatus });
                
                // Update badge and select UI
                statusSelect.value = nextStatus;
                const badge = document.getElementById(`badge-status-${flow}-${id}`);
                badge.className = `badge badge-${nextStatus}`;
                badge.textContent = nextStatus;
                
                // 3. Copy to clipboard
                await navigator.clipboard.writeText(textVal);
                
                const originalText = btn.textContent;
                btn.textContent = '✓ Saved & Copied!';
                btn.style.backgroundColor = '#1D4ED8';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.style.backgroundColor = '';
                }, 2000);
                
            } catch (err) {
                alert('Saved, but failed to write to clipboard.');
            }
        });
    });

    el.historyList.querySelectorAll('.btn-delete-history').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to permanently delete this entry from the desk log?')) {
                return;
            }
            
            const flow = btn.getAttribute('data-type');
            const id = btn.getAttribute('data-id');
            
            try {
                const res = await apiRequest(`/history/${flow}/${id}`, 'DELETE');
                if (!res.error) {
                    fetchHistory(state.activeBusinessId);
                } else {
                    alert('Failed to delete: ' + res.message);
                }
            } catch (err) {
                alert('Connection failure during deletion.');
            }
        });
    });
}

function navigateHistoryPage(dir) {
    state.historyPage += dir;
    if (state.historyPage < 0) state.historyPage = 0;
    fetchHistory(state.activeBusinessId);
}

// Pacing ribbon helper
function updatePacingRibbon(pacingWarning, dailyCount) {
    if (dailyCount !== undefined) {
        el.ribbonCount.textContent = dailyCount;
    }
    
    if (pacingWarning) {
        el.pacingRibbon.classList.remove('hidden');
        el.pacingMessage.textContent = `Google Pacing Alert: You have generated/posted ${dailyCount} reviews/replies today. Bulk-posting templates can read as spammy to search crawlers. Consider spacing them out.`;
    } else {
        el.pacingRibbon.classList.add('hidden');
    }
}

// Error Banner Helper
function showError(bannerEl, msg) {
    bannerEl.textContent = msg;
    bannerEl.classList.remove('hidden');
}

// API request wrapper
async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    
    const options = {
        method,
        headers
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    
    // Check if unauthorized, force logout
    if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/register') {
        handleLogout();
        throw new Error('Unauthorized');
    }
    
    const data = await response.json();
    return data;
}

// Utilities
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
