  
        // ==========================================
        // LOADING PAGE FUNCTIONALITY
        // ==========================================
        
        // Hide loader when DOM content is loaded
        window.addEventListener('DOMContentLoaded', () => {
            // Small delay for visual effect
            setTimeout(() => {
                const loader = document.getElementById('loaderOverlay');
                if (loader) {
                    loader.classList.add('hidden');
                    // Remove from DOM after transition completes
                    setTimeout(() => {
                        loader.style.display = 'none';
                    }, 500);
                }
            }, 800); // Show loader for at least 800ms
        });
        
        // Fallback: Hide loader if DOMContentLoaded already fired
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    const loader = document.getElementById('loaderOverlay');
                    if (loader) {
                        loader.classList.add('hidden');
                        setTimeout(() => {
                            loader.style.display = 'none';
                        }, 500);
                    }
                }, 800);
            });
        } else {
            // DOM already loaded, hide loader immediately
            setTimeout(() => {
                const loader = document.getElementById('loaderOverlay');
                if (loader) {
                    loader.classList.add('hidden');
                    setTimeout(() => {
                        loader.style.display = 'none';
                    }, 500);
                }
            }, 800);
        }

        // استيراد دوال Firebase
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
        import { getDatabase, ref, get, set, push, remove, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
        import { getAuth, signInWithPopup, GoogleAuthProvider, FacebookAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
        import { initializeAppCheck, CustomProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js";

        // App Check. The site key is public (it ships in every reCAPTCHA site); the
        // secret key belongs in the Firebase console only. Empty key = App Check off.
        const APP_CHECK_PROVIDER = 'v3'; // 'v3' | 'enterprise'
        const APP_CHECK_SITE_KEY = '6LfOzWMtAAAAAAW39iLdEElqkKyZ2vFejEFnOV7c';
        // reCAPTCHA is unreachable on some networks; without a deadline the built-in
        // providers never settle and every Firebase call hangs forever.
        const APP_CHECK_TIMEOUT_MS = 10000;
        const APP_CHECK_RETRY_COOLDOWN_MS = 10000;

        const firebaseConfig = {
            apiKey: "AIzaSyDzn8bbFgyVclO43J7b__eVDJ_-1fX5an4",
            authDomain: "candlecars-42b49.firebaseapp.com",
            projectId: "candlecars-42b49",
            databaseURL: "https://candlecars-42b49-default-rtdb.firebaseio.com",
            storageBucket: "candlecars-42b49.appspot.com",
            messagingSenderId: "591577705638",
            appId: "1:591577705638:web:b4049a4113fd7d61b41867"
           
        };

        window.openUserVerification = async () => {
            if (!isAdmin) {
                alert('Admin access required');
                return;
            }
            if (!db) {
                alert('Database not connected');
                return;
            }

            document.getElementById('userVerificationError').style.display = 'none';
            document.getElementById('userVerificationList').innerHTML = '';
            document.getElementById('userVerificationModal').style.display = 'flex';

            const searchInput = document.getElementById('userVerificationSearchEmail');
            if (searchInput) {
                searchInput.value = '';
            }

            const renderPendingUsers = (pending) => {
                const container = document.getElementById('userVerificationList');
                if (!container) return;

                const q = (document.getElementById('userVerificationSearchEmail')?.value || '').trim().toLowerCase();
                const filtered = q
                    ? pending.filter((u) => ((u.email || '').toString().toLowerCase().includes(q)))
                    : pending;

                if (filtered.length === 0) {
                    container.innerHTML = '<div style="color:#888; text-align:center; padding: 20px;">No pending accounts</div>';
                    return;
                }

                container.innerHTML = filtered.map((u) => {
                    const safeName = escapeHtml((u.name || 'User').toString());
                    const safeEmail = escapeHtml((u.email || '').toString());
                    const safePhone = escapeHtml((u.phone || '').toString());

                    return `
                        <div style="background:#252525; border:1px solid #333; border-radius:12px; padding:14px; margin-bottom:12px; display:flex; gap:12px; align-items:center; justify-content:space-between;">
                            <div style="flex:1; min-width: 0;">
                                <div style="color: var(--gold); font-weight: 700; overflow:hidden; text-overflow: ellipsis; white-space: nowrap;">${safeName}</div>
                                <div style="color:#aaa; font-size: 13px; overflow:hidden; text-overflow: ellipsis; white-space: nowrap;">${safeEmail}</div>
                                <div style="color:#888; font-size: 12px;">${safePhone}</div>
                                <div style="color:#666; font-size: 11px; margin-top: 4px;">uid: ${escapeHtml(u.uid)}</div>
                            </div>
                            <div style="display:flex; gap:10px;">
                                <button class="admin-btn" style="background:#2ecc71;" onclick="approveUser('${safeAttr(u.uid)}')">Approve</button>
                                <button class="admin-btn" style="background:#e74c3c;" onclick="rejectUser('${safeAttr(u.uid)}')">Reject</button>
                            </div>
                        </div>
                    `;
                }).join('');
            };

            try {
                if (userVerificationUnsubscribe) {
                    userVerificationUnsubscribe();
                    userVerificationUnsubscribe = null;
                }

                const usersRef = ref(db, 'users');
                // Keep latest pending list for searching
                window.__pendingUsersForVerification = [];

                if (searchInput) {
                    searchInput.oninput = () => {
                        renderPendingUsers(window.__pendingUsersForVerification || []);
                    };
                }

                userVerificationUnsubscribe = onValue(usersRef, (snapshot) => {
                    const users = snapshot.val() || {};
                    const pending = Object.entries(users)
                        .map(([uid, u]) => ({ uid, ...u }))
                        .filter((u) => u && u.uid && u.verified === false);
                    window.__pendingUsersForVerification = pending;
                    renderPendingUsers(pending);
                });
            } catch (error) {
                console.error('Failed to load pending users:', error);
                const errEl = document.getElementById('userVerificationError');
                if (errEl) {
                    errEl.textContent = 'Failed to load users. Please try again.';
                    errEl.style.display = 'block';
                }
            }
        };

        window.approveUser = async (uid) => {
            if (!isAdmin || !db) return;
            try {
                await set(ref(db, 'users/' + uid + '/verified'), true);
            } catch (error) {
                console.error('Approve user failed:', error);
                alert('Failed to approve user');
            }
        };

        window.rejectUser = async (uid) => {
            if (!isAdmin || !db) return;
            const ok = confirm('Reject this user? This will remove their profile from database.');
            if (!ok) return;
            try {
                await remove(ref(db, 'users/' + uid));
            } catch (error) {
                console.error('Reject user failed:', error);
                alert('Failed to reject user');
            }
        };

        window.openAdminManagement = async () => {
            if (!currentUser || !isSuperAdmin(currentUser.email)) {
                alert('Only the main controllers can manage admins.');
                return;
            }
            if (!db) {
                alert('Database not connected');
                return;
            }
            const errEl = document.getElementById('adminMgmtError');
            if (errEl) errEl.style.display = 'none';
            const modal = document.getElementById('adminMgmtModal');
            if (modal) modal.style.display = 'flex';
            const searchInput = document.getElementById('adminMgmtSearch');
            if (searchInput) {
                searchInput.value = '';
                searchInput.oninput = () => renderAdminMgmt();
            }
            await renderAdminMgmt();
        };

        async function renderAdminMgmt() {
            const container = document.getElementById('adminMgmtList');
            if (!container) return;
            container.innerHTML = '<div style="color:#888;text-align:center;padding:20px;">Loading...</div>';

            let users = {}, admins = {};
            try {
                const [uSnap, aSnap] = await Promise.all([
                    get(ref(db, 'users')),
                    get(ref(db, 'admin/admins'))
                ]);
                users = uSnap.val() || {};
                admins = aSnap.val() || {};
            } catch (e) {
                console.error('Load admin management failed:', e);
                container.innerHTML = '<div style="color:#e74c3c;text-align:center;padding:20px;">Failed to load users</div>';
                return;
            }

            const q = (document.getElementById('adminMgmtSearch')?.value || '').trim().toLowerCase();
            const rows = Object.entries(users)
                .map(([uid, u]) => ({ uid, ...(u || {}) }))
                .filter((u) => u.uid)
                .filter((u) => !q || String(u.email || '').toLowerCase().includes(q) || String(u.name || '').toLowerCase().includes(q));

            if (rows.length === 0) {
                container.innerHTML = '<div style="color:#888;text-align:center;padding:20px;">No users found</div>';
                return;
            }

            container.innerHTML = rows.map((u) => {
                const isSup = isSuperAdmin(u.email);
                const isAdm = !!admins[u.uid];
                let action;
                if (isSup) {
                    action = '<span style="color:var(--gold);font-size:12px;font-weight:700;">Controller 👑</span>';
                } else if (isAdm) {
                    action = `<button class="admin-btn" style="background:#e74c3c;" onclick="removeAdmin('${safeAttr(u.uid)}')">Remove Admin</button>`;
                } else {
                    action = `<button class="admin-btn" style="background:#2ecc71;" onclick="makeAdmin('${safeAttr(u.uid)}')">Make Admin</button>`;
                }
                const badge = (isSup || isAdm) ? '<span style="color:#4dff88;font-size:12px;"> • Admin</span>' : '';
                return `
                    <div style="background:#252525;border:1px solid #333;border-radius:12px;padding:14px;margin-bottom:12px;display:flex;gap:12px;align-items:center;justify-content:space-between;">
                        <div style="flex:1;min-width:0;">
                            <div style="color:var(--gold);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(u.name || 'User')}${badge}</div>
                            <div style="color:#aaa;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(u.email || '')}</div>
                            <div style="color:#666;font-size:11px;margin-top:4px;">uid: ${escapeHtml(u.uid)}</div>
                        </div>
                        <div style="display:flex;gap:10px;">${action}</div>
                    </div>
                `;
            }).join('');
        }

        window.makeAdmin = async (uid) => {
            if (!currentUser || !isSuperAdmin(currentUser.email) || !db) return;
            try {
                await set(ref(db, 'admin/admins/' + uid), true);
                await renderAdminMgmt();
            } catch (e) {
                console.error('Make admin failed:', e);
                alert('Failed to add admin');
            }
        };

        window.removeAdmin = async (uid) => {
            if (!currentUser || !isSuperAdmin(currentUser.email) || !db) return;
            const ok = confirm('Remove admin privileges from this user?');
            if (!ok) return;
            try {
                await remove(ref(db, 'admin/admins/' + uid));
                await renderAdminMgmt();
            } catch (e) {
                console.error('Remove admin failed:', e);
                alert('Failed to remove admin');
            }
        };

        // ==========================================
        // DEALER INVENTORY FEEDS (controllers only)
        // A dealer authorises their inventory provider to publish a CSV/XML feed
        // URL; the import itself runs on the server (netlify/functions/import-feeds).
        // ==========================================
        function ensureFeedsModal() {
            let modal = document.getElementById('feedsModal');
            if (modal) return modal;

            modal = document.createElement('div');
            modal.id = 'feedsModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 720px;">
                    <span class="close" onclick="closeModal('feedsModal')">&times;</span>
                    <h2 style="color: var(--gold); margin-bottom: 4px;">Dealer Inventory Feeds</h2>
                    <div style="color:#888; font-size:13px; margin-bottom:16px;">
                        Import a dealership's stock automatically from a CSV/XML feed URL. Only add feeds you have written permission to publish.
                    </div>

                    <div style="background:#252525; border:1px solid #333; border-radius:12px; padding:14px; margin-bottom:18px;">
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                            <div><label style="color:#aaa;font-size:12px;">Dealer name</label><input id="feedDealerName" type="text" placeholder="Highland Auto Sales"></div>
                            <div><label style="color:#aaa;font-size:12px;">Contact phone</label><input id="feedPhone" type="text" placeholder="9095551234"></div>
                        </div>
                        <label style="color:#aaa;font-size:12px;">Feed URL (https, CSV or XML)</label>
                        <input id="feedUrl" type="url" placeholder="https://feeds.example.com/dealer123/inventory.csv">
                        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;">
                            <div>
                                <label style="color:#aaa;font-size:12px;">Format</label>
                                <select id="feedFormat"><option value="auto">Auto detect</option><option value="csv">CSV / TSV</option><option value="xml">XML</option></select>
                            </div>
                            <div><label style="color:#aaa;font-size:12px;">Max cars</label><input id="feedMaxCars" type="number" min="1" max="1000" value="200"></div>
                            <div><label style="color:#aaa;font-size:12px;">Dealer account UID (optional)</label><input id="feedOwnerUid" type="text" placeholder="for chat/ownership"></div>
                        </div>
                        <input id="feedEditingId" type="hidden">
                        <div id="feedsFormMsg" style="display:none; font-size:13px; margin:10px 0; white-space:pre-wrap;"></div>
                        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px;">
                            <button class="admin-btn" style="background:#3498db;" onclick="previewFeed()">Test feed</button>
                            <button class="admin-btn" style="background:#2ecc71;" onclick="saveFeed()">Save feed</button>
                            <button class="admin-btn" style="background:#555;" onclick="resetFeedForm()">Clear</button>
                        </div>
                    </div>

                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="color:var(--gold); font-weight:700;">Configured feeds</div>
                        <button class="admin-btn" style="background:var(--gold); color:#000;" onclick="runFeedNow()">Import all now</button>
                    </div>
                    <div id="feedsList"></div>
                </div>`;
            document.body.appendChild(modal);
            return modal;
        }

        function feedsMessage(text, ok) {
            const el = document.getElementById('feedsFormMsg');
            if (!el) return;
            el.textContent = text;
            el.style.color = ok ? '#4dff88' : '#ff6b6b';
            el.style.display = text ? 'block' : 'none';
        }

        window.resetFeedForm = () => {
            ['feedDealerName', 'feedPhone', 'feedUrl', 'feedOwnerUid', 'feedEditingId'].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            const maxCars = document.getElementById('feedMaxCars');
            if (maxCars) maxCars.value = '200';
            const format = document.getElementById('feedFormat');
            if (format) format.value = 'auto';
            feedsMessage('', true);
        };

        window.openFeedsManager = async () => {
            if (!currentUser || !isSuperAdmin(currentUser.email)) {
                alert('Only the main controllers can manage inventory feeds.');
                return;
            }
            if (!db) { alert('Database not connected'); return; }
            const modal = ensureFeedsModal();
            window.resetFeedForm();
            modal.style.display = 'flex';
            await renderFeedsList();
        };

        async function renderFeedsList() {
            const container = document.getElementById('feedsList');
            if (!container) return;
            container.innerHTML = '<div style="color:#888;text-align:center;padding:16px;">Loading...</div>';

            let feeds = {};
            try {
                const snap = await get(ref(db, 'admin/feeds'));
                feeds = snap.val() || {};
            } catch (e) {
                container.innerHTML = '<div style="color:#e74c3c;text-align:center;padding:16px;">Failed to load feeds</div>';
                return;
            }

            const entries = Object.entries(feeds);
            if (!entries.length) {
                container.innerHTML = '<div style="color:#888;text-align:center;padding:16px;">No feeds yet.</div>';
                return;
            }

            container.innerHTML = entries.map(([id, feed]) => {
                const f = feed || {};
                const last = f.lastRun ? new Date(f.lastRun).toLocaleString() : 'never';
                const status = f.lastError
                    ? `<div style="color:#ff6b6b;font-size:12px;margin-top:4px;">Error: ${escapeHtml(String(f.lastError))}</div>`
                    : `<div style="color:#4dff88;font-size:12px;margin-top:4px;">Last import: ${escapeHtml(String(f.lastCount || 0))} cars · ${escapeHtml(last)}</div>`;
                return `
                    <div style="background:#252525;border:1px solid #333;border-radius:12px;padding:14px;margin-bottom:12px;">
                        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                            <div style="flex:1;min-width:0;">
                                <div style="color:var(--gold);font-weight:700;">${escapeHtml(f.dealerName || id)}${f.enabled === false ? ' <span style="color:#888;font-size:12px;">(disabled)</span>' : ''}</div>
                                <div style="color:#aaa;font-size:12px;word-break:break-all;">${escapeHtml(f.url || '')}</div>
                                ${status}
                            </div>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;">
                                <button class="admin-btn" style="background:var(--gold);color:#000;" onclick="runFeedNow('${safeAttr(id)}')">Import now</button>
                                <button class="admin-btn" style="background:#3498db;" onclick="editFeed('${safeAttr(id)}')">Edit</button>
                                <button class="admin-btn" style="background:#7f8c8d;" onclick="toggleFeedEnabled('${safeAttr(id)}')">${f.enabled === false ? 'Enable' : 'Disable'}</button>
                                <button class="admin-btn" style="background:#e74c3c;" onclick="deleteFeed('${safeAttr(id)}')">Delete</button>
                            </div>
                        </div>
                    </div>`;
            }).join('');
        }

        function readFeedForm() {
            return {
                dealerName: (document.getElementById('feedDealerName')?.value || '').trim(),
                phone: (document.getElementById('feedPhone')?.value || '').replace(/\D/g, ''),
                url: (document.getElementById('feedUrl')?.value || '').trim(),
                format: document.getElementById('feedFormat')?.value || 'auto',
                maxCars: Math.max(1, Math.min(1000, Number(document.getElementById('feedMaxCars')?.value) || 200)),
                ownerUid: (document.getElementById('feedOwnerUid')?.value || '').trim()
            };
        }

        async function callFeedFunction(payload) {
            if (!currentUser) throw new Error('Please sign in first.');
            const idToken = await currentUser.getIdToken();
            const res = await fetch(`${FUNCTIONS_BASE}/import-feeds`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
            return data;
        }

        window.previewFeed = async () => {
            const form = readFeedForm();
            if (!form.url) { feedsMessage('Enter a feed URL first.', false); return; }
            feedsMessage('Reading the feed...', true);
            try {
                const data = await callFeedFunction({ preview: true, url: form.url, format: form.format, dealerName: form.dealerName, phone: form.phone });
                const sample = (data.samples || []).map((car) => `• ${car.name} — $${car.price}`).join('\n');
                feedsMessage(`Found ${data.rows} rows, ${data.usable} usable cars.\n${sample}`, true);
            } catch (error) {
                feedsMessage(error.message, false);
            }
        };

        window.saveFeed = async () => {
            const form = readFeedForm();
            if (!form.dealerName || !form.url) { feedsMessage('Dealer name and feed URL are required.', false); return; }
            const editingId = (document.getElementById('feedEditingId')?.value || '').trim();
            const id = editingId || `${form.dealerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}-${Date.now().toString(36)}`;
            try {
                const existing = editingId ? (await get(ref(db, 'admin/feeds/' + id))).val() || {} : {};
                await set(ref(db, 'admin/feeds/' + id), {
                    ...existing,
                    dealerName: form.dealerName,
                    phone: form.phone,
                    url: form.url,
                    format: form.format,
                    maxCars: form.maxCars,
                    ownerUid: form.ownerUid || null,
                    enabled: existing.enabled === false ? false : true,
                    updatedAt: Date.now()
                });
                feedsMessage('Feed saved.', true);
                window.resetFeedForm();
                await renderFeedsList();
            } catch (error) {
                feedsMessage('Could not save the feed: ' + error.message, false);
            }
        };

        window.editFeed = async (id) => {
            try {
                const feed = (await get(ref(db, 'admin/feeds/' + id))).val() || {};
                document.getElementById('feedEditingId').value = id;
                document.getElementById('feedDealerName').value = feed.dealerName || '';
                document.getElementById('feedPhone').value = feed.phone || '';
                document.getElementById('feedUrl').value = feed.url || '';
                document.getElementById('feedFormat').value = feed.format || 'auto';
                document.getElementById('feedMaxCars').value = feed.maxCars || 200;
                document.getElementById('feedOwnerUid').value = feed.ownerUid || '';
                feedsMessage('Editing "' + (feed.dealerName || id) + '". Press Save feed when done.', true);
            } catch (error) {
                feedsMessage('Could not open this feed.', false);
            }
        };

        window.toggleFeedEnabled = async (id) => {
            try {
                const feed = (await get(ref(db, 'admin/feeds/' + id))).val() || {};
                await set(ref(db, 'admin/feeds/' + id), { ...feed, enabled: feed.enabled === false });
                await renderFeedsList();
            } catch (error) {
                feedsMessage('Could not update the feed.', false);
            }
        };

        window.deleteFeed = async (id) => {
            if (!confirm('Delete this feed? Cars already imported stay on the site.')) return;
            try {
                await remove(ref(db, 'admin/feeds/' + id));
                await remove(ref(db, 'admin/feedItems/' + id));
                await renderFeedsList();
            } catch (error) {
                feedsMessage('Could not delete the feed.', false);
            }
        };

        window.runFeedNow = async (id) => {
            feedsMessage('Importing... this can take up to a minute.', true);
            try {
                const data = await callFeedFunction(id ? { feedId: id } : {});
                const lines = (data.results || []).map((r) => r.error
                    ? `• ${r.feedId}: ${r.error}`
                    : `• ${r.dealerName || r.feedId}: ${r.imported} cars (${r.created} new, ${r.updated} updated, ${r.soldOut} marked sold)`);
                feedsMessage(lines.join('\n') || (data.message || 'Nothing to import.'), true);
                await renderFeedsList();
            } catch (error) {
                feedsMessage(error.message, false);
            }
        };


        // التحقق من صحة الإعدادات
        if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
            console.error('Missing Firebase configuration!');
            document.addEventListener('DOMContentLoaded', () => {
                const errorEl = document.getElementById('signupError') || document.getElementById('signinError');
                if (errorEl) {
                    errorEl.textContent = 'Firebase configuration error. Please contact admin.';
                    errorEl.style.display = 'block';
                }
            });
        }

        let app;
        try {
            app = initializeApp(firebaseConfig);
            console.log('Firebase initialized successfully');
        } catch (error) {
            console.error('Firebase initialization error:', error);
        }

        const isEnterpriseAppCheck = APP_CHECK_PROVIDER === 'enterprise';

        let recaptchaScriptPromise = null;
        function loadRecaptchaScript() {
            if (recaptchaScriptPromise) return recaptchaScriptPromise;
            recaptchaScriptPromise = new Promise((resolve, reject) => {
                const file = isEnterpriseAppCheck ? 'enterprise.js' : 'api.js';
                const script = document.createElement('script');
                script.src = `https://www.google.com/recaptcha/${file}?render=${encodeURIComponent(APP_CHECK_SITE_KEY)}`;
                script.onload = resolve;
                script.onerror = () => reject(new Error('reCAPTCHA script blocked or unreachable'));
                document.head.appendChild(script);
            });
            return recaptchaScriptPromise;
        }

        async function requestAppCheckToken() {
            await loadRecaptchaScript();
            const rc = isEnterpriseAppCheck ? grecaptcha.enterprise : grecaptcha;
            await new Promise((resolve) => rc.ready(resolve));
            const recaptchaToken = await rc.execute(APP_CHECK_SITE_KEY, { action: 'fire_app_check' });

            const method = isEnterpriseAppCheck ? 'exchangeRecaptchaEnterpriseToken' : 'exchangeRecaptchaV3Token';
            const body = isEnterpriseAppCheck
                ? { recaptcha_enterprise_token: recaptchaToken }
                : { recaptcha_v3_token: recaptchaToken };
            const response = await fetch(
                `https://content-firebaseappcheck.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
                `/apps/${firebaseConfig.appId}:${method}?key=${firebaseConfig.apiKey}`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
            );
            if (!response.ok) {
                throw new Error(`App Check exchange failed with HTTP ${response.status}`);
            }
            const data = await response.json();
            const ttlMs = (parseFloat(data.ttl) || 3600) * 1000;
            return { token: data.token, expireTimeMillis: Date.now() + ttlMs };
        }

        let appCheckRetryAfter = 0;
        let appCheckFailureLogged = false;

        // Firebase blocks every request while a token is pending and retries immediately
        // when one is rejected, so an unreachable reCAPTCHA must resolve to a placeholder
        // token: the app then works unverified instead of freezing or hot-looping.
        async function getAppCheckToken() {
            const wait = appCheckRetryAfter - Date.now();
            if (wait > 0) {
                await new Promise((resolve) => setTimeout(resolve, wait));
                return { token: 'app-check-unavailable', expireTimeMillis: Date.now() + APP_CHECK_RETRY_COOLDOWN_MS };
            }
            try {
                const token = await Promise.race([
                    requestAppCheckToken(),
                    new Promise((_, reject) => setTimeout(
                        () => reject(new Error('App Check timed out')), APP_CHECK_TIMEOUT_MS))
                ]);
                appCheckFailureLogged = false;
                return token;
            } catch (error) {
                appCheckRetryAfter = Date.now() + APP_CHECK_RETRY_COOLDOWN_MS;
                if (!appCheckFailureLogged) {
                    appCheckFailureLogged = true;
                    console.warn('App Check unavailable, continuing unverified:', error.message);
                }
                return { token: 'app-check-unavailable', expireTimeMillis: Date.now() + APP_CHECK_RETRY_COOLDOWN_MS };
            }
        }

        // Must run before any other Firebase service so requests carry an App Check token.
        if (app && APP_CHECK_SITE_KEY) {
            try {
                initializeAppCheck(app, {
                    provider: new CustomProvider({ getToken: getAppCheckToken }),
                    isTokenAutoRefreshEnabled: true
                });
                console.log('App Check initialized successfully');
            } catch (error) {
                console.error('App Check initialization error:', error);
            }
        }

        let db = null;
        let auth = null;
        
        if (app) {
            try {
                db = getDatabase(app);
                console.log('Database connected successfully');
                
                } catch (error) {
                console.error('Database connection error:', error);
            }
            
            try {
                auth = getAuth(app);
                console.log('Auth initialized successfully');
            } catch (error) {
                console.error('Auth initialization error:', error);
            }
        }

        // Self-heal: if Firebase requests start failing with permission-denied /
        // auth-internal errors, the most common cause is a corrupted cached
        // Auth session or App Check token sitting in IndexedDB (the same thing
        // "Clear browsing data" fixes manually). This wipes just the Firebase
        // IndexedDB stores and reloads once, so users don't have to do it by hand.
        const RECOVERY_FLAG = 'gw_fb_recovery_attempted';
        async function recoverCorruptedFirebaseState(reason) {
            if (sessionStorage.getItem(RECOVERY_FLAG)) {
                console.error('Firebase recovery already attempted this session, not retrying. Reason:', reason);
                return;
            }
            console.warn('Attempting Firebase local-state recovery due to:', reason);
            sessionStorage.setItem(RECOVERY_FLAG, '1');
            try {
                if (window.indexedDB && indexedDB.databases) {
                    const dbs = await indexedDB.databases();
                    await Promise.all(
                        dbs
                            .filter(d => d.name && /firebase|app-check/i.test(d.name))
                            .map(d => new Promise((resolve) => {
                                const req = indexedDB.deleteDatabase(d.name);
                                req.onsuccess = resolve;
                                req.onerror = resolve;
                                req.onblocked = resolve;
                            }))
                    );
                }
            } catch (e) {
                console.error('Recovery cleanup failed:', e);
            }
            location.reload();
        }
        function isPermissionOrAuthError(error) {
            const code = (error && (error.code || error.message || '')).toString().toLowerCase();
            return code.includes('permission_denied') || code.includes('permission-denied') ||
                   code.includes('auth/internal-error') || code.includes('appcheck');
        }

        const myDeviceId = localStorage.getItem('my_device_id') || 'dev_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('my_device_id', myDeviceId);

        let isAdmin = false, carsData = {}, searchQuery = "", currentFilter = 'all';
        let currentUser = null;
        let currentUserProfile = null;
        let isUserVerified = false;

        let chatCurrentCarId = null;
        let chatActiveThreadId = null;
        let chatActiveThreadMeta = null;
        let inboxUnsub = null;
        let threadUnsub = null;
        let messagesUnsub = null;
        let inboxThreadIds = [];
        let usersCache = null;
        let usersCacheAt = 0;
        let userSearchTimer = null;
        let userVerificationUnsubscribe = null;
        let adminEmail = localStorage.getItem('admin_email') || '';
        // Controller accounts are identified by a salted fingerprint so their addresses are not
        // published in this file. Authorization itself is enforced by the database rules.
        const SUPER_ADMIN_SALT = 'GW-ADMIN::';
        const SUPER_ADMIN_FINGERPRINTS = [
            'fc554dcedddf582d779a5bad5bb13328a75d9fd7f566454c507dc5ebc9b2d133',
            '477e1e8affd25d75ea08d1884d57ebe8db75c66be7133e2478da07e23c1232e9'
        ];

        function sha256Hex(input) {
            const K = [
                0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
                0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
                0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
                0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
                0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
                0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
                0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
                0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
            ];
            const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
            const rotr = (x, n) => (x >>> n) | (x << (32 - n));

            const bytes = [];
            for (let i = 0; i < input.length; i++) {
                const c = input.charCodeAt(i);
                if (c < 0x80) bytes.push(c);
                else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
                else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
            }
            const bitLen = bytes.length * 8;
            bytes.push(0x80);
            while (bytes.length % 64 !== 56) bytes.push(0);
            bytes.push(0, 0, 0, 0, (bitLen >>> 24) & 255, (bitLen >>> 16) & 255, (bitLen >>> 8) & 255, bitLen & 255);

            const w = new Array(64);
            for (let off = 0; off < bytes.length; off += 64) {
                for (let i = 0; i < 16; i++) {
                    const j = off + i * 4;
                    w[i] = (bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3];
                }
                for (let i = 16; i < 64; i++) {
                    const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                    const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                    w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
                }
                let [a, b, c, d, e, f, g, hh] = h;
                for (let i = 0; i < 64; i++) {
                    const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
                    const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
                    hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
                }
                const next = [a, b, c, d, e, f, g, hh];
                for (let i = 0; i < 8; i++) h[i] = (h[i] + next[i]) | 0;
            }
            return h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
        }

        const isSuperAdmin = (email) => {
            if (!email) return false;
            return SUPER_ADMIN_FINGERPRINTS.includes(sha256Hex(SUPER_ADMIN_SALT + String(email).trim().toLowerCase()));
        };

        // ==========================================
        // LISTING SUBSCRIPTION (Stripe)
        // The paywall only appears when a user tries to publish a car. The real
        // check lives in the database rules and in the Netlify functions; this
        // code is only the interface.
        // ==========================================
        const SUBSCRIPTION_PLAN = { name: 'Dealer Basic Plan', price: '$39.99', period: 'per month' };
        const FUNCTIONS_BASE = '/.netlify/functions';
        const CHECKOUT_POLL_MS = 2000;
        const CHECKOUT_POLL_TIMEOUT_MS = 120000;

        const checkoutReturnState = (() => {
            try { return new URLSearchParams(location.search).get('checkout'); } catch { return null; }
        })();
        let mySubscription = null;
        let subscriptionActivation = null;

        function subscriptionIsActive(sub) {
            if (!sub) return false;
            const status = String(sub.status || '');
            if (status !== 'active' && status !== 'trialing') return false;
            return Number(sub.currentPeriodEnd || 0) > Date.now();
        }

        async function fetchMySubscription() {
            if (!currentUser || !db) return null;
            try {
                const snap = await get(ref(db, 'subscriptions/' + currentUser.uid));
                mySubscription = snap.exists() ? snap.val() : null;
            } catch (e) {
                mySubscription = null;
            }
            return mySubscription;
        }

        window.canPublishListing = async () => {
            if (!currentUser) return false;
            if (isAdmin) return true;
            if (subscriptionActivation) await subscriptionActivation;
            return subscriptionIsActive(await fetchMySubscription());
        };

        function ensureSubscriptionModal() {
            let modal = document.getElementById('subscriptionModal');
            if (modal) return modal;

            modal = document.createElement('div');
            modal.id = 'subscriptionModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 460px; text-align: center;">
                    <h2 style="color: var(--gold); margin-bottom: 6px;">${escapeHtml(SUBSCRIPTION_PLAN.name)}</h2>
                    <div style="color:#aaa; font-size: 14px; margin-bottom: 18px;">A subscription is required to publish a car for sale.</div>
                    <div style="background:#252525; border:1px solid #333; border-radius:14px; padding:18px; margin-bottom:18px;">
                        <div style="color: var(--gold); font-size: 34px; font-weight: 800;">${escapeHtml(SUBSCRIPTION_PLAN.price)}</div>
                        <div style="color:#888; font-size: 13px;">${escapeHtml(SUBSCRIPTION_PLAN.period)} · cancel anytime</div>
                        <ul style="text-align:left; color:#ccc; font-size:14px; margin: 16px 0 0; padding-left: 20px; line-height: 1.9;">
                            <li>Publish unlimited car listings</li>
                            <li>Edit and manage your listings</li>
                            <li>Chat with buyers</li>
                        </ul>
                    </div>
                    <div id="subscriptionModalError" style="display:none; color:#ff6b6b; font-size:13px; margin-bottom:12px;"></div>
                    <button id="subscriptionCheckoutBtn" class="BUY" style="background-color: var(--gold); color: black;">SUBSCRIBE NOW</button>
                    <button type="button" onclick="closeModal('subscriptionModal')" style="background:none; border:none; color:#888; width:100%; margin-top:10px; cursor:pointer;">Not now</button>
                    <div style="color:#666; font-size:11px; margin-top:12px;">Secure payment handled by Stripe. Your card details never reach this site.</div>
                </div>`;
            document.body.appendChild(modal);
            modal.querySelector('#subscriptionCheckoutBtn').onclick = startSubscriptionCheckout;
            return modal;
        }

        window.openSubscriptionModal = () => {
            if (!currentUser) {
                alert('Please sign in first');
                if (window.openSignIn) window.openSignIn();
                return;
            }
            const modal = ensureSubscriptionModal();
            const errorEl = modal.querySelector('#subscriptionModalError');
            if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }
            modal.style.display = 'flex';
        };

        async function startSubscriptionCheckout() {
            const modal = ensureSubscriptionModal();
            const btn = modal.querySelector('#subscriptionCheckoutBtn');
            const errorEl = modal.querySelector('#subscriptionModalError');
            const showError = (message) => {
                if (!errorEl) { alert(message); return; }
                errorEl.textContent = message;
                errorEl.style.display = 'block';
            };

            if (!currentUser) { showError('Please sign in first.'); return; }
            btn.disabled = true;
            const label = btn.innerText;
            btn.innerText = 'Opening secure checkout...';
            try {
                const idToken = await currentUser.getIdToken();
                const res = await fetch(`${FUNCTIONS_BASE}/create-checkout-session`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
                    body: '{}'
                });
                const data = await res.json().catch(() => ({}));
                if (data.alreadyActive) {
                    modal.style.display = 'none';
                    await fetchMySubscription();
                    const upload = document.getElementById('uploadModal');
                    if (upload) upload.style.display = 'flex';
                    return;
                }
                if (!res.ok || !data.url) throw new Error(data.error || 'Checkout is unavailable right now.');
                location.href = data.url;
            } catch (error) {
                showError(error.message);
                btn.disabled = false;
                btn.innerText = label;
            }
        }

        window.openBillingPortal = async () => {
            if (!currentUser) { if (window.openSignIn) window.openSignIn(); return; }
            try {
                const idToken = await currentUser.getIdToken();
                const res = await fetch(`${FUNCTIONS_BASE}/create-portal-session`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
                    body: '{}'
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.url) throw new Error(data.error || 'Billing portal is unavailable right now.');
                location.href = data.url;
            } catch (error) {
                alert(error.message);
            }
        };

        function showActivationOverlay(show, message) {
            let overlay = document.getElementById('subscriptionActivationOverlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = 'subscriptionActivationOverlay';
                overlay.className = 'modal';
                overlay.innerHTML = `
                    <div class="modal-content" style="max-width: 380px; text-align:center;">
                        <h2 style="color: var(--gold);">Confirming your payment</h2>
                        <div id="subscriptionActivationText" style="color:#bbb; font-size:14px;">Please wait a moment...</div>
                    </div>`;
                document.body.appendChild(overlay);
            }
            const text = overlay.querySelector('#subscriptionActivationText');
            if (text && message) text.textContent = message;
            overlay.style.display = show ? 'flex' : 'none';
        }

        // Stripe confirms the payment through the webhook, so the browser has to
        // wait for the server to write the subscription before publishing.
        async function waitForSubscriptionActivation() {
            const deadline = Date.now() + CHECKOUT_POLL_TIMEOUT_MS;
            showActivationOverlay(true, 'Please wait a moment...');
            try {
                while (Date.now() < deadline) {
                    if (subscriptionIsActive(await fetchMySubscription())) return true;
                    await new Promise((resolve) => setTimeout(resolve, CHECKOUT_POLL_MS));
                }
                return false;
            } finally {
                showActivationOverlay(false);
            }
        }

        let checkoutReturnHandled = false;

        async function handleCheckoutReturn() {
            if (checkoutReturnHandled || checkoutReturnState !== 'success' || !currentUser) return;
            checkoutReturnHandled = true;
            try { history.replaceState({}, '', location.pathname); } catch {}
            if (subscriptionIsActive(await fetchMySubscription())) return;
            subscriptionActivation = waitForSubscriptionActivation();
            const activated = await subscriptionActivation;
            subscriptionActivation = null;
            if (!activated) {
                alert('Your payment is still being confirmed. Please refresh this page in a minute.');
            }
        }

        if (checkoutReturnState && checkoutReturnState !== 'success') {
            try { history.replaceState({}, '', location.pathname); } catch {}
        }

        let unreadByThread = {};
        let activeToastThreadId = null;
        let toastTimer = null;

        function getChatReadMap() {
            try {
                return JSON.parse(localStorage.getItem('chat_last_read') || '{}') || {};
            } catch {
                return {};
            }
        }
        function setChatReadMap(map) {
            try {
                localStorage.setItem('chat_last_read', JSON.stringify(map || {}));
            } catch {}
        }
        function getKnownUpdateMap() {
            try {
                return JSON.parse(localStorage.getItem('chat_known_updates') || '{}') || {};
            } catch {
                return {};
            }
        }
        function setKnownUpdateMap(map) {
            try {
                localStorage.setItem('chat_known_updates', JSON.stringify(map || {}));
            } catch {}
        }

        function updateInboxBadge() {
            const inboxLink = document.getElementById('inboxLink');
            if (!inboxLink) return;
            const total = Object.values(unreadByThread || {}).reduce((a, b) => a + (Number(b) || 0), 0);

            let badge = inboxLink.querySelector('.inbox-badge');
            if (total > 0) {
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'inbox-badge';
                    inboxLink.appendChild(badge);
                }
                badge.textContent = String(total);
            } else {
                if (badge) badge.remove();
            }
        }

        function hideChatToast() {
            const toast = document.getElementById('chatToast');
            if (!toast) return;
            toast.style.display = 'none';
            toast.innerHTML = '';
            activeToastThreadId = null;
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = null;
        }

        window.hideChatToast = hideChatToast;

        function showChatToast({ threadId, title, text }) {
            const toast = document.getElementById('chatToast');
            if (!toast) return;
            activeToastThreadId = threadId;
            const safeTitle = escapeHtml(String(title || 'New message'));
            const safeText = escapeHtml(String(text || ''));
            toast.innerHTML = `
                <div><strong>${safeTitle}</strong></div>
                <div style="margin-top:6px; color:#ddd; font-size: 13px; line-height: 1.35;">${safeText}</div>
                <div class="chat-toast-actions">
                    <button onclick="hideChatToast()">Dismiss</button>
                    <button class="primary" onclick="openToastThread()">Open</button>
                </div>
            `;
            toast.style.display = 'block';
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = setTimeout(() => {
                hideChatToast();
            }, 7000);
        }

        window.openToastThread = () => {
            const tid = activeToastThreadId;
            if (!tid) return;
            const modal = document.getElementById('chatModal');
            if (modal) modal.style.display = 'flex';
            openChatThread(tid);
            hideChatToast();
        };

        function isListingOwner(car) {
            return !!(currentUser && car && (car.ownerUid || car.ownerId) && currentUser.uid && (currentUser.uid === car.ownerUid || currentUser.uid === car.ownerId));
        }

        // Compare functionality
        let compareIds = JSON.parse(localStorage.getItem('compareCars') || '[]');

        window.isCompared = (carId) => {
            return Array.isArray(compareIds) && compareIds.includes(carId);
        };

        function persistCompare() {
            localStorage.setItem('compareCars', JSON.stringify(compareIds));
        }

        function normalizeCompareIds() {
            if (!Array.isArray(compareIds)) compareIds = [];
            compareIds = compareIds.filter(Boolean);
            compareIds = Array.from(new Set(compareIds));
        }

        // Auth state listener
        onAuthStateChanged(auth, (user) => {
            currentUser = user;
            loadAdminSettings()
                .finally(() => loadCurrentUserProfile())
                .finally(async () => {
                    isAdmin = false;
                    if (currentUser && currentUser.email) {
                        if (isSuperAdmin(currentUser.email)) {
                            isAdmin = true;
                        } else if (db) {
                            try {
                                const snap = await get(ref(db, 'admin/admins/' + currentUser.uid));
                                isAdmin = snap.exists() && !!snap.val();
                            } catch (e) {
                                isAdmin = false;
                            }
                        }
                    }
                    updateAuthUI();
                    refreshUI();
                    handleCheckoutReturn();
                });
        });

        function buildThreadId(carId, uidA, uidB) {
            const a = String(uidA || '').trim();
            const b = String(uidB || '').trim();
            const ids = [a, b].sort();
            return `${String(carId)}_${ids[0]}_${ids[1]}`;
        }

        function buildDmThreadId(uidA, uidB) {
            const a = String(uidA || '').trim();
            const b = String(uidB || '').trim();
            const ids = [a, b].sort();
            return `dm_${ids[0]}_${ids[1]}`;
        }

        function formatChatTime(ts) {
            if (!ts || typeof ts !== 'number') return '';
            try {
                return new Date(ts).toLocaleString();
            } catch {
                return '';
            }
        }

        function cleanupChatSubscriptions() {
            try { if (inboxUnsub) inboxUnsub(); } catch {}
            try { if (threadUnsub) threadUnsub(); } catch {}
            try { if (messagesUnsub) messagesUnsub(); } catch {}
            inboxUnsub = null;
            threadUnsub = null;
            messagesUnsub = null;
        }

        window.closeChatModal = () => {
            cleanupChatSubscriptions();
            closeModal('chatModal');
        };

        window.openInbox = () => {
            if (!currentUser) {
                alert('Please sign in to use messages');
                openSignIn();
                return;
            }
            const modal = document.getElementById('chatModal');
            if (modal) modal.style.display = 'flex';
            const resultsEl = document.getElementById('chatUserSearchResults');
            if (resultsEl) resultsEl.innerHTML = '';
            const inputEl = document.getElementById('chatUserSearchInput');
            if (inputEl) inputEl.value = '';
            refreshInbox();
        };

        async function getAllUsersCached() {
            if (!db) return {};
            const now = Date.now();
            if (usersCache && (now - usersCacheAt) < 2 * 60 * 1000) {
                return usersCache;
            }
            try {
                const snap = await get(ref(db, 'users'));
                usersCache = snap.val() || {};
                usersCacheAt = now;
                return usersCache;
            } catch (e) {
                console.error('getAllUsersCached error:', e);
                return usersCache || {};
            }
        }

        window.handleUserSearch = () => {
            if (!currentUser) return;
            const inputEl = document.getElementById('chatUserSearchInput');
            const q = inputEl ? String(inputEl.value || '').trim() : '';
            if (userSearchTimer) clearTimeout(userSearchTimer);
            userSearchTimer = setTimeout(() => {
                runUserSearch(q);
            }, 250);
        };

        async function runUserSearch(query) {
            const resultsEl = document.getElementById('chatUserSearchResults');
            if (!resultsEl) return;

            const q = String(query || '').trim().toLowerCase();
            if (!q) {
                resultsEl.innerHTML = '';
                return;
            }

            const users = await getAllUsersCached();
            const matches = Object.entries(users)
                .map(([uid, u]) => ({ uid, u: u || {} }))
                .filter(({ uid, u }) => {
                    if (!uid) return false;
                    if (currentUser && uid === currentUser.uid) return false;
                    const name = u && u.name ? String(u.name) : '';
                    if (!name) return false;
                    return name.toLowerCase().includes(q);
                })
                .slice(0, 12);

            if (matches.length === 0) {
                resultsEl.innerHTML = '<div style="color:#aaa; font-size:12px; padding: 4px 2px;">No users found.</div>';
                return;
            }

            resultsEl.innerHTML = '';
            matches.forEach(({ uid, u }) => {
                const name = u && u.name ? String(u.name) : 'User';
                const verified = u && u.verified === true;
                const item = document.createElement('div');
                item.className = 'chat-thread-item';
                item.onclick = () => openDirectChat(uid, name);
                item.innerHTML = `
                    <div class="chat-thread-title">${escapeHtml(name)}${verified ? ' ✅' : ''}</div>
                    <div class="chat-thread-sub">Start chat</div>
                `;
                resultsEl.appendChild(item);
            });
        }

        window.openDirectChat = async (otherUid, otherName) => {
            if (!currentUser) {
                alert('Please sign in to chat');
                openSignIn();
                return;
            }
            if (!db) return;
            const uid = String(otherUid || '').trim();
            if (!uid) return;
            if (uid === currentUser.uid) {
                alert('You cannot chat with yourself');
                return;
            }

            const threadId = buildDmThreadId(currentUser.uid, uid);
            const threadRef = ref(db, `threads/${threadId}`);
            const now = Date.now();

            try {
                const existing = await get(threadRef);
                if (!existing.exists()) {
                    const title = `DM · ${String(otherName || 'User')}`;
                    await set(threadRef, {
                        createdAt: now,
                        updatedAt: now,
                        carId: null,
                        title,
                        participants: {
                            [currentUser.uid]: true,
                            [uid]: true
                        },
                        lastMessage: ''
                    });
                }

                await set(ref(db, `userThreads/${currentUser.uid}/${threadId}`), true);
                await set(ref(db, `userThreads/${uid}/${threadId}`), true);

                const modal = document.getElementById('chatModal');
                if (modal) modal.style.display = 'flex';
                refreshInbox();
                openChatThread(threadId);
            } catch (e) {
                console.error('openDirectChat error:', e);
                alert('Failed to start chat. Please try again.');
            }
        };

        window.refreshInbox = () => {
            if (!currentUser || !db) return;
            const listEl = document.getElementById('chatThreadList');
            if (listEl) listEl.innerHTML = '';
            inboxThreadIds = [];

            const known = getKnownUpdateMap();
            const readMap = getChatReadMap();
            const firstLoadKey = `chat_inbox_firstload_${currentUser.uid}`;
            const isFirstLoad = !localStorage.getItem(firstLoadKey);

            try { if (inboxUnsub) inboxUnsub(); } catch {}
            inboxUnsub = onValue(ref(db, `userThreads/${currentUser.uid}`), async (snap) => {
                const val = snap.val() || {};
                inboxThreadIds = Object.keys(val);

                if (!listEl) return;
                if (inboxThreadIds.length === 0) {
                    listEl.innerHTML = '<div style="color:#aaa; padding: 10px;">No conversations yet.</div>';
                    return;
                }

                const metas = await Promise.all(inboxThreadIds.map(async (tid) => {
                    try {
                        const s = await get(ref(db, `threads/${tid}`));
                        return { id: tid, data: s.val() || null };
                    } catch {
                        return { id: tid, data: null };
                    }
                }));

                unreadByThread = {};

                metas.forEach(({ id, data }) => {
                    const updatedAt = data && typeof data.updatedAt === 'number' ? data.updatedAt : 0;
                    const lastSenderUid = data && data.lastSenderUid ? String(data.lastSenderUid) : '';
                    const lastRead = readMap && typeof readMap[id] === 'number' ? readMap[id] : 0;

                    const isUnread = updatedAt > lastRead && lastSenderUid && currentUser && lastSenderUid !== currentUser.uid;
                    unreadByThread[id] = isUnread ? 1 : 0;

                    const lastKnown = known && typeof known[id] === 'number' ? known[id] : 0;
                    if (updatedAt > 0 && updatedAt > lastKnown) {
                        if (!isFirstLoad && lastSenderUid && currentUser && lastSenderUid !== currentUser.uid) {
                            showChatToast({
                                threadId: id,
                                title: data && data.title ? String(data.title) : 'New message',
                                text: data && data.lastMessage ? String(data.lastMessage) : 'New message received'
                            });
                        }
                        known[id] = updatedAt;
                    }
                });

                setKnownUpdateMap(known);
                if (isFirstLoad) {
                    try { localStorage.setItem(firstLoadKey, '1'); } catch {}
                }
                updateInboxBadge();

                metas.sort((a, b) => {
                    const at = a.data && typeof a.data.updatedAt === 'number' ? a.data.updatedAt : 0;
                    const bt = b.data && typeof b.data.updatedAt === 'number' ? b.data.updatedAt : 0;
                    return bt - at;
                });

                listEl.innerHTML = '';
                metas.forEach(({ id, data }) => {
                    const title = data && data.title ? String(data.title) : 'Conversation';
                    const sub = data && data.lastMessage ? String(data.lastMessage) : '';
                    const time = data && data.updatedAt ? formatChatTime(data.updatedAt) : '';
                    const unread = unreadByThread && unreadByThread[id] ? true : false;

                    const item = document.createElement('div');
                    item.className = 'chat-thread-item' + (chatActiveThreadId === id ? ' active' : '');
                    item.onclick = () => openChatThread(id);
                    item.innerHTML = `
                        <div class="chat-thread-title">${escapeHtml(title)}${unread ? ' <span style="color:#e74c3c; font-weight: 900;">•</span>' : ''}</div>
                        <div class="chat-thread-sub">${sub ? escapeHtml(sub) : 'No messages yet'}${time ? ` · ${escapeHtml(time)}` : ''}</div>
                    `;
                    listEl.appendChild(item);
                });
            });
        };

        window.closeChatThread = () => {
            chatActiveThreadId = null;
            chatActiveThreadMeta = null;
            try { if (threadUnsub) threadUnsub(); } catch {}
            try { if (messagesUnsub) messagesUnsub(); } catch {}
            threadUnsub = null;
            messagesUnsub = null;
            const titleEl = document.getElementById('chatMainTitle');
            const msgEl = document.getElementById('chatMessages');
            if (titleEl) titleEl.textContent = 'Select a conversation';
            if (msgEl) msgEl.innerHTML = '';
            refreshInbox();
        };

        window.openChatThread = (threadId) => {
            if (!currentUser || !db) return;
            if (!threadId) return;

            chatActiveThreadId = threadId;
            const titleEl = document.getElementById('chatMainTitle');
            const msgEl = document.getElementById('chatMessages');
            if (msgEl) msgEl.innerHTML = '';

            try { if (threadUnsub) threadUnsub(); } catch {}
            try { if (messagesUnsub) messagesUnsub(); } catch {}
            threadUnsub = null;
            messagesUnsub = null;

            threadUnsub = onValue(ref(db, `threads/${threadId}`), (snap) => {
                chatActiveThreadMeta = snap.val() || null;
                const title = chatActiveThreadMeta && chatActiveThreadMeta.title ? String(chatActiveThreadMeta.title) : 'Conversation';
                if (titleEl) titleEl.textContent = title;

                const updatedAt = chatActiveThreadMeta && typeof chatActiveThreadMeta.updatedAt === 'number' ? chatActiveThreadMeta.updatedAt : Date.now();
                const readMap = getChatReadMap();
                readMap[threadId] = updatedAt;
                setChatReadMap(readMap);
                unreadByThread[threadId] = 0;
                updateInboxBadge();
                refreshInbox();
            });

            messagesUnsub = onValue(ref(db, `messages/${threadId}`), (snap) => {
                const all = snap.val() || {};
                const entries = Object.entries(all)
                    .map(([id, m]) => ({ id, ...(m || {}) }))
                    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

                if (!msgEl) return;
                msgEl.innerHTML = '';
                entries.forEach((m) => {
                    const mine = currentUser && m.senderUid && currentUser.uid === m.senderUid;
                    const div = document.createElement('div');
                    div.className = 'chat-msg' + (mine ? ' mine' : '');
                    const t = m.text ? String(m.text) : '';
                    div.innerHTML = `
                        <div>${t.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                        <div class="chat-msg-meta">${formatChatTime(m.createdAt)}</div>
                    `;
                    msgEl.appendChild(div);
                });
                msgEl.scrollTop = msgEl.scrollHeight;
            });

            refreshInbox();
        };

        window.sendChatMessage = async () => {
            if (!currentUser || !db) return;
            if (!chatActiveThreadId) return;

            const input = document.getElementById('chatInput');
            const btn = document.getElementById('chatSendBtn');
            const text = input ? String(input.value || '').trim() : '';
            if (!text) return;

            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Sending...';
            }

            try {
                const msg = {
                    senderUid: currentUser.uid,
                    text,
                    createdAt: Date.now()
                };
                await push(ref(db, `messages/${chatActiveThreadId}`), msg);
                await set(ref(db, `threads/${chatActiveThreadId}/lastMessage`), text.slice(0, 120));
                await set(ref(db, `threads/${chatActiveThreadId}/lastSenderUid`), currentUser.uid);
                await set(ref(db, `threads/${chatActiveThreadId}/updatedAt`), Date.now());
                if (input) input.value = '';
            } catch (e) {
                console.error('sendChatMessage error:', e);
                alert('Failed to send message. Please try again.');
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Send';
                }
            }
        };

        window.startChatWithSeller = async () => {
            if (!currentUser) {
                alert('Please sign in to chat');
                openSignIn();
                return;
            }
            if (!chatCurrentCarId) {
                alert('No car selected');
                return;
            }
            const car = carsData && chatCurrentCarId ? carsData[chatCurrentCarId] : null;
            if (!car || !car.ownerUid) {
                alert('Seller account not available for chat');
                return;
            }
            if (currentUser.uid === car.ownerUid) {
                alert('You cannot chat with yourself');
                return;
            }

            const threadId = buildThreadId(chatCurrentCarId, currentUser.uid, car.ownerUid);
            const threadRef = ref(db, `threads/${threadId}`);
            const now = Date.now();

            try {
                const existing = await get(threadRef);
                if (!existing.exists()) {
                    const sellerResolved = await resolveSellerFromCar(car);
                    const sellerName = sellerResolved && sellerResolved.name ? String(sellerResolved.name) : 'Seller';
                    const title = `${car.name} · ${sellerName}`;

                    await set(threadRef, {
                        createdAt: now,
                        updatedAt: now,
                        carId: chatCurrentCarId,
                        title,
                        participants: {
                            [currentUser.uid]: true,
                            [car.ownerUid]: true
                        },
                        lastMessage: ''
                    });
                }

                await set(ref(db, `userThreads/${currentUser.uid}/${threadId}`), true);
                await set(ref(db, `userThreads/${car.ownerUid}/${threadId}`), true);

                const modal = document.getElementById('chatModal');
                if (modal) modal.style.display = 'flex';
                
                // Use setTimeout to ensure modal is fully rendered before loading content
                setTimeout(() => {
                    refreshInbox();
                    openChatThread(threadId);
                }, 50);
            } catch (e) {
                console.error('startChatWithSeller error:', e);
                alert('Failed to start chat. Please try again.');
            }
        };

        async function loadAdminSettings() {
            if (!db) return;
            try {
                const settingsSnapshot = await get(ref(db, 'admin/settings'));
                const settings = settingsSnapshot.val();
                if (settings && settings.adminEmail) {
                    adminEmail = settings.adminEmail;
                    localStorage.setItem('admin_email', adminEmail);
                }
            } catch (error) {
                console.log('Could not fetch admin settings');
            }
        }

        async function loadCurrentUserProfile() {
            currentUserProfile = null;
            isUserVerified = false;

            if (!currentUser || !db) {
                return;
            }

            try {
                const userRef = ref(db, 'users/' + currentUser.uid);
                const userSnapshot = await get(userRef);
                const userData = userSnapshot.val();

                if (userData) {
                    currentUserProfile = userData;
                    if (typeof userData.verified === 'boolean') {
                        isUserVerified = userData.verified;
                    } else {
                        await set(ref(db, 'users/' + currentUser.uid + '/verified'), false);
                        isUserVerified = false;
                    }
                } else {
                    const autoProfile = {
                        name: currentUser.displayName || 'User',
                        email: currentUser.email || '',
                        phone: '',
                        createdAt: Date.now(),
                        verified: false
                    };
                    await set(ref(db, 'users/' + currentUser.uid), autoProfile);
                    currentUserProfile = autoProfile;
                    isUserVerified = false;
                }
            } catch (error) {
                console.error('Failed to load user profile:', error);
                if (isPermissionOrAuthError(error)) {
                    recoverCorruptedFirebaseState('loadUserProfile: ' + error.message);
                }
            }
        }

        function updateAuthUI() {
            const authBtns = document.getElementById('authButtons');
            const userInfo = document.getElementById('userInfo');
            const logoutLink = document.getElementById('logoutLink');
            const settingsLink = document.getElementById('settingsLink');
            const verifyLink = document.getElementById('userVerificationLink');
            const inboxLink = document.getElementById('inboxLink');
            const manageAdminsLink = document.getElementById('manageAdminsLink');
            const canManageAdmins = !!(currentUser && isSuperAdmin(currentUser.email));

            if (currentUser) {
                if (authBtns) authBtns.style.display = 'none';
                if (userInfo) {
                    userInfo.style.display = 'block';
                    document.getElementById('userName').textContent = currentUser.displayName || 'User';
                    document.getElementById('userEmail').textContent = currentUser.email;
                    const verifiedEl = document.getElementById('userVerifiedStatus');
                    if (verifiedEl) {
                        verifiedEl.textContent = isUserVerified ? 'Verified ✅' : 'Pending verification ⏳';
                        verifiedEl.style.color = isUserVerified ? '#4dff88' : '#ffcc00';
                    }
                }

                if (logoutLink) logoutLink.style.display = isAdmin ? 'block' : 'none';
                if (settingsLink) settingsLink.style.display = isAdmin ? 'block' : 'none';
                if (verifyLink) verifyLink.style.display = isAdmin ? 'block' : 'none';
                if (manageAdminsLink) manageAdminsLink.style.display = canManageAdmins ? 'block' : 'none';
                ensureFeedsMenuLink(canManageAdmins);
                if (inboxLink) inboxLink.style.display = 'block';
            } else {
                if (authBtns) authBtns.style.display = 'block';
                if (userInfo) userInfo.style.display = 'none';

                if (logoutLink) logoutLink.style.display = 'none';
                if (settingsLink) settingsLink.style.display = 'none';
                if (verifyLink) verifyLink.style.display = 'none';
                if (manageAdminsLink) manageAdminsLink.style.display = 'none';
                ensureFeedsMenuLink(false);
                if (inboxLink) inboxLink.style.display = 'none';
            }
        }

        function ensureFeedsMenuLink(visible) {
            const anchor = document.getElementById('manageAdminsLink');
            if (!anchor) return;
            let link = document.getElementById('dealerFeedsLink');
            if (!link) {
                link = document.createElement('a');
                link.id = 'dealerFeedsLink';
                link.textContent = '🔗 Dealer Feeds';
                link.style.display = 'none';
                link.onclick = () => { if (window.toggleMenu) window.toggleMenu(); window.openFeedsManager(); };
                anchor.parentNode.insertBefore(link, anchor.nextSibling);
            }
            link.style.display = visible ? 'block' : 'none';
        }

        // Switch between sign in and signup modals
        window.switchToSignup = () => {
            closeModal('signInModal');
            document.getElementById('signupModal').style.display = 'flex';
        };

        window.switchToSignin = () => {
            closeModal('signupModal');
            document.getElementById('signInModal').style.display = 'flex';
        };

        // Open sign in modal
        window.openSignIn = () => {
            document.getElementById('signInModal').style.display = 'flex';
        };

        // Open sign up modal
        window.openSignUp = () => {
            document.getElementById('signupModal').style.display = 'flex';
        };

        // Google Sign In
        window.signInWithGoogle = async () => {
            const errorEl = document.getElementById('signinError');
            const googleBtn = document.getElementById('googleSignInBtn');
            
            if (!auth) {
                errorEl.textContent = 'Authentication not available. Please try again later.';
                errorEl.style.display = 'block';
                return;
            }

            try {
                if (googleBtn) {
                    const originalText = googleBtn.innerHTML;
                    googleBtn.innerHTML = '<span class="btn-spinner"></span> Connecting...';
                    googleBtn.disabled = true;
                }
                errorEl.style.display = 'none';

                const provider = new GoogleAuthProvider();
                const userCredential = await signInWithPopup(auth, provider);
                console.log('Google sign in successful:', userCredential.user);

                // Check if user exists in database, if not create profile
                const userSnapshot = await get(ref(db, 'users/' + userCredential.user.uid));
                if (!userSnapshot.exists()) {
                    // Create user profile in database
                    await set(ref(db, 'users/' + userCredential.user.uid), {
                        name: userCredential.user.displayName || 'User',
                        email: userCredential.user.email,
                        phone: '',
                        createdAt: Date.now(),
                        verified: false
                    });
                    console.log('New user profile created');
                }

                closeModal('signInModal');
                alert('Welcome! Signed in with Google successfully.');
            } catch (error) {
                console.error('Google sign in error:', error);
                
                if (error.code === 'auth/popup-closed-by-user') {
                    // User closed the popup, no need to show error
                } else if (error.code === 'auth/cancelled-popup-request') {
                    // Only one popup request allowed at a time
                } else {
                    errorEl.textContent = 'Google sign in failed. Please try again.';
                    errorEl.style.display = 'block';
                }
            } finally {
                if (googleBtn) {
                    googleBtn.innerHTML = `
                        <svg viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                    `;
                    googleBtn.disabled = false;
                }
            }
        };

        // Facebook Sign In
        window.signInWithFacebook = async () => {
            const errorEl = document.getElementById('signinError');
            const facebookBtn = document.getElementById('facebookSignInBtn');
            
            if (!auth) {
                errorEl.textContent = 'Authentication not available. Please try again later.';
                errorEl.style.display = 'block';
                return;
            }

            try {
                if (facebookBtn) {
                    const originalText = facebookBtn.innerHTML;
                    facebookBtn.innerHTML = '<span class="btn-spinner"></span> Connecting...';
                    facebookBtn.disabled = true;
                }
                errorEl.style.display = 'none';

                const provider = new FacebookAuthProvider();
                // Add Facebook scopes if needed
                provider.addScope('email');
                provider.addScope('public_profile');
                
                const userCredential = await signInWithPopup(auth, provider);
                console.log('Facebook sign in successful:', userCredential.user);

                // Check if user exists in database, if not create profile
                const userSnapshot = await get(ref(db, 'users/' + userCredential.user.uid));
                if (!userSnapshot.exists()) {
                    // Create user profile in database
                    await set(ref(db, 'users/' + userCredential.user.uid), {
                        name: userCredential.user.displayName || 'User',
                        email: userCredential.user.email || '',
                        phone: '',
                        createdAt: Date.now()
                    });
                    console.log('New user profile created');
                }

                closeModal('signInModal');
                alert('Welcome! Signed in with Facebook successfully.');
            } catch (error) {
                console.error('Facebook sign in error:', error);
                
                if (error.code === 'auth/popup-closed-by-user') {
                    // User closed the popup, no need to show error
                } else if (error.code === 'auth/cancelled-popup-request') {
                    // Only one popup request allowed at a time
                } else if (error.code === 'auth/unauthorized-domain') {
                    errorEl.textContent = 'Facebook sign in is not configured for this domain.';
                    errorEl.style.display = 'block';
                } else {
                    errorEl.textContent = 'Facebook sign in failed. Please try again.';
                    errorEl.style.display = 'block';
                }
            } finally {
                if (facebookBtn) {
                    facebookBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="white">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        Continue with Facebook
                    `;
                    facebookBtn.disabled = false;
                }
            }
        };

        // Google Sign Up (same as sign in but closes signup modal)
        window.signUpWithGoogle = async () => {
            const errorEl = document.getElementById('signupError');
            const googleBtn = document.getElementById('googleSignUpBtn');
            
            if (!auth) {
                errorEl.textContent = 'Authentication not available. Please try again later.';
                errorEl.style.display = 'block';
                return;
            }

            try {
                if (googleBtn) {
                    const originalText = googleBtn.innerHTML;
                    googleBtn.innerHTML = '<span class="btn-spinner"></span> Creating account...';
                    googleBtn.disabled = true;
                }
                errorEl.style.display = 'none';

                const provider = new GoogleAuthProvider();
                const userCredential = await signInWithPopup(auth, provider);
                console.log('Google sign up successful:', userCredential.user);

                // Create user profile in database
                await set(ref(db, 'users/' + userCredential.user.uid), {
                    name: userCredential.user.displayName || 'User',
                    email: userCredential.user.email,
                    phone: '',
                    createdAt: Date.now(),
                    verified: false
                });
                console.log('New user profile created from Google signup');

                closeModal('signupModal');
                alert('Welcome! Account created with Google successfully.');
            } catch (error) {
                console.error('Google sign up error:', error);
                
                if (error.code === 'auth/popup-closed-by-user') {
                    // User closed the popup, no need to show error
                } else if (error.code === 'auth/cancelled-popup-request') {
                    // Only one popup request allowed at a time
                } else {
                    errorEl.textContent = 'Google sign up failed. Please try again.';
                    errorEl.style.display = 'block';
                }
            } finally {
                if (googleBtn) {
                    googleBtn.innerHTML = `
                        <svg viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                        Continue with Google
                    `;
                    googleBtn.disabled = false;
                }
            }
        };

        // Facebook Sign Up (same as sign in but closes signup modal)
        window.signUpWithFacebook = async () => {
            const errorEl = document.getElementById('signupError');
            const facebookBtn = document.getElementById('facebookSignUpBtn');
            
            if (!auth) {
                errorEl.textContent = 'Authentication not available. Please try again later.';
                errorEl.style.display = 'block';
                return;
            }

            try {
                if (facebookBtn) {
                    const originalText = facebookBtn.innerHTML;
                    facebookBtn.innerHTML = '<span class="btn-spinner"></span> Creating account...';
                    facebookBtn.disabled = true;
                }
                errorEl.style.display = 'none';

                const provider = new FacebookAuthProvider();
                // Add Facebook scopes if needed
                provider.addScope('email');
                provider.addScope('public_profile');
                
                const userCredential = await signInWithPopup(auth, provider);
                console.log('Facebook sign up successful:', userCredential.user);

                // Create user profile in database
                await set(ref(db, 'users/' + userCredential.user.uid), {
                    name: userCredential.user.displayName || 'User',
                    email: userCredential.user.email || '',
                    phone: '',
                    createdAt: Date.now(),
                    verified: false
                });
                console.log('New user profile created from Facebook signup');

                closeModal('signupModal');
                alert('Welcome! Account created with Facebook successfully.');
            } catch (error) {
                console.error('Facebook sign up error:', error);
                
                if (error.code === 'auth/popup-closed-by-user') {
                    // User closed the popup, no need to show error
                } else if (error.code === 'auth/cancelled-popup-request') {
                    // Only one popup request allowed at a time
                } else if (error.code === 'auth/unauthorized-domain') {
                    errorEl.textContent = 'Facebook sign up is not configured for this domain.';
                    errorEl.style.display = 'block';
                } else {
                    errorEl.textContent = 'Facebook sign up failed. Please try again.';
                    errorEl.style.display = 'block';
                }
            } finally {
                if (facebookBtn) {
                    facebookBtn.innerHTML = `
                        <svg viewBox="0 0 24 24" fill="white">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        Continue with Facebook
                    `;
                    facebookBtn.disabled = false;
                }
            }
        };

        // Sign in with email and password
        document.getElementById('signinBtn')?.addEventListener('click', async () => {
            const email = document.getElementById('signinEmail').value.trim();
            const password = document.getElementById('signinPassword').value;
            const errorEl = document.getElementById('signinError');
            const btn = document.getElementById('signinBtn');

            if (!email || !password) {
                errorEl.textContent = 'Please fill in all fields';
                errorEl.style.display = 'block';
                return;
            }

            try {
                btn.textContent = 'Signing in...';
                btn.disabled = true;
                errorEl.style.display = 'none';

                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log('Signed in successfully:', userCredential.user);
                
                closeModal('signInModal');
                document.getElementById('signinEmail').value = '';
                document.getElementById('signinPassword').value = '';
                alert('Welcome back!');
            } catch (error) {
                console.error('Sign in error:', error);
                errorEl.textContent = getAuthErrorMessage(error.code);
                errorEl.style.display = 'block';
            } finally {
                btn.textContent = 'SIGN IN';
                btn.disabled = false;
            }
        });

// Helper function to compress profile picture
        const compressProfilePic = (file) => new Promise((resolve, reject) => {
            if (!file) {
                resolve(null);
                return;
            }
            
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // Resize to 150x150 for profile pictures
                    const maxSize = 150;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height) {
                        if (width > maxSize) {
                            height *= maxSize / width;
                            width = maxSize;
                        }
                    } else {
                        if (height > maxSize) {
                            width *= maxSize / height;
                            height = maxSize;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Compress to JPEG with 0.6 quality
                    const compressedImage = canvas.toDataURL('image/jpeg', 0.6);
                    console.log('Profile pic size:', compressedImage.length, 'characters');
                    resolve(compressedImage);
                };
                img.onerror = (err) => {
                    console.error('Error loading image:', err);
                    resolve(null);
                };
            };
            reader.onerror = (err) => {
                console.error('Error reading file:', err);
                resolve(null);
            };
        });

        // Handle signup drop zone file change
        window.handleSignupDropZoneChange = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            // Check file type
            if (!file.type.match('image.*')) {
                alert('Please select an image file');
                return;
            }
            
            // Check file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                alert('Image size should be less than 2MB');
                return;
            }
            
            // Show preview
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('signupPicPreview');
                const previewImg = document.getElementById('signupPicPreviewImg');
                const dropZone = document.getElementById('signupDropZone');
                
                previewImg.src = e.target.result;
                preview.style.display = 'block';
                dropZone.style.display = 'none';
            };
            reader.readAsDataURL(file);
        };

        // Clear signup profile picture
        window.clearSignupProfilePic = () => {
            document.getElementById('signupProfilePic').value = '';
            document.getElementById('signupPicPreview').style.display = 'none';
            document.getElementById('signupDropZone').style.display = 'block';
        };

        // Initialize drag and drop for signup drop zone
        window.addEventListener('DOMContentLoaded', () => {
            const dropZone = document.getElementById('signupDropZone');
            if (dropZone) {
                // Prevent default drag behaviors
                ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                    dropZone.addEventListener(eventName, preventDefaults, false);
                    document.body.addEventListener(eventName, preventDefaults, false);
                });

                function preventDefaults(e) {
                    e.preventDefault();
                    e.stopPropagation();
                }

                // Highlight drop zone when dragging over it
                ['dragenter', 'dragover'].forEach(eventName => {
                    dropZone.addEventListener(eventName, highlight, false);
                });

                ['dragleave', 'drop'].forEach(eventName => {
                    dropZone.addEventListener(eventName, unhighlight, false);
                });

                function highlight(e) {
                    dropZone.classList.add('dragover');
                }

                function unhighlight(e) {
                    dropZone.classList.remove('dragover');
                }

                // Handle dropped files
                dropZone.addEventListener('drop', handleDrop, false);

                function handleDrop(e) {
                    const dt = e.dataTransfer;
                    const files = dt.files;
                    
                    if (files.length > 0) {
                        // Create a new FileList-like object
                        const fileInput = document.getElementById('signupProfilePic');
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(files[0]);
                        fileInput.files = dataTransfer.files;
                        
                        // Trigger the change event
                        const event = new Event('change', { bubbles: true });
                        fileInput.dispatchEvent(event);
                    }
                }
            }
        });

        // Sign up with email and password
        document.getElementById('signupBtn')?.addEventListener('click', async () => {
            const name = document.getElementById('signupName').value.trim();
            const email = document.getElementById('signupEmail').value.trim();
            const phone = document.getElementById('signupPhone').value.trim();
            const password = document.getElementById('signupPassword').value;
            const profilePicFile = document.getElementById('signupProfilePic').files[0];
            const errorEl = document.getElementById('signupError');
            const successEl = document.getElementById('signupSuccess');
            const btn = document.getElementById('signupBtn');

            if (!name || !email || !phone || !password) {
                errorEl.textContent = 'Please fill in all fields';
                errorEl.style.display = 'block';
                return;
            }

            // Validate password strength
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.isValid) {
                errorEl.textContent = passwordValidation.message;
                errorEl.style.display = 'block';
                return;
            }

            try {
                btn.textContent = 'Creating account...';
                btn.disabled = true;
                errorEl.style.display = 'none';
                successEl.style.display = 'none';

                console.log('Starting signup process...');
                console.log('Email:', email);

                // Create user account
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                console.log('User created successfully:', userCredential.user.uid);

                // Update user profile with name (using the imported function)
                try {
                    await updateProfile(userCredential.user, {
                        displayName: name
                    });
                    console.log('User profile updated with name');
                } catch (profileError) {
                    console.log('Profile update skipped:', profileError);
                }

                // Process profile picture if selected
                let profilePicData = null;
                if (profilePicFile) {
                    console.log('Processing profile picture...');
                    profilePicData = await compressProfilePic(profilePicFile);
                    if (profilePicData) {
                        console.log('Profile picture compressed successfully');
                    }
                }

                // Prepare user data object
                const userData = {
                    name: name,
                    email: email,
                    phone: phone,
                    createdAt: Date.now(),
                    verified: false
                };

                // Add profile picture to user data if available
                if (profilePicData) {
                    userData.profilePic = profilePicData;
                }

                // Save user profile to database
                await set(ref(db, 'users/' + userCredential.user.uid), userData);
                console.log('User data saved to database');

                // Refresh the header/UI immediately so the new name shows up
                // without needing a reload or re-login.
                currentUser = userCredential.user;
                currentUserProfile = userData;
                updateAuthUI();
                
                if (profilePicData) {
                    console.log('Profile picture saved to database');
                    // Save to localStorage for quick access
                    localStorage.setItem('profile_pic_' + userCredential.user.uid, profilePicData);
                    
                    // Update all profile pictures on page immediately
                    const profileFullAvatar = document.getElementById('profileFullAvatar');
                    const profileAvatar = document.getElementById('profileAvatar');
                    const sideProfilePic = document.getElementById('sideProfilePic');
                    
                    if (profileFullAvatar) profileFullAvatar.src = profilePicData;
                    if (profileAvatar) profileAvatar.src = profilePicData;
                    if (sideProfilePic) sideProfilePic.src = profilePicData;
                }

                successEl.textContent = 'Account created successfully!';
                successEl.style.display = 'block';
                
                setTimeout(() => {
                    closeModal('signupModal');
                    document.getElementById('signupName').value = '';
                    document.getElementById('signupEmail').value = '';
                    document.getElementById('signupPhone').value = '';
                    document.getElementById('signupPassword').value = '';
                    document.getElementById('signupProfilePic').value = ''; // Clear file input
                    successEl.style.display = 'none';
                    alert('Welcome to Golden Wheel!');
                }, 1500);

            } catch (error) {
                console.error('Sign up error:', error);
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
                if (isPermissionOrAuthError(error)) {
                    recoverCorruptedFirebaseState('signup: ' + error.message);
                }
                
                // Show more detailed error
                let errorMessage = getAuthErrorMessage(error.code);
                if (error.message) {
                    console.log('Full error:', error.message);
                }
                errorEl.textContent = errorMessage;
                errorEl.style.display = 'block';
            } finally {
                btn.textContent = 'CREATE ACCOUNT';
                btn.disabled = false;
            }
        });

        // Sign out
        window.signOutUser = async () => {
            try {
                await signOut(auth);
                console.log('Signed out successfully');
                alert('You have been signed out');
            } catch (error) {
                console.error('Sign out error:', error);
            }
        };

        // Helper function to get error messages
        function getAuthErrorMessage(errorCode) {
            if (!errorCode) {
                return 'Network error. Please check your connection.';
            }
            switch (errorCode) {
                case 'auth/user-not-found':
                    return 'No account found with this email';
                case 'auth/wrong-password':
                    return 'Incorrect password';
                case 'auth/email-already-in-use':
                    return 'An account with this email already exists';
                case 'auth/invalid-email':
                    return 'Invalid email address';
                case 'auth/weak-password':
                    return 'Password is too weak (min 6 characters)';
                case 'auth/too-many-requests':
                    return 'Too many attempts. Please try again later';
                case 'auth/operation-not-allowed':
                    return 'Email/password sign-in is not enabled. Contact admin.';
                case 'auth/network-request-failed':
                    return 'Network error. Please check your connection.';
                default:
                    return 'Error: ' + (errorCode.replace('auth/', '') || 'Unknown error');
            }
        }

        // Validate password strength
        function validatePassword(password) {
            const minLength = 8;
            const hasUpperCase = /[A-Z]/.test(password);
            const hasLowerCase = /[a-z]/.test(password);
            const hasNumbers = /\d/.test(password);
            const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

            if (password.length < minLength) {
                return { isValid: false, message: `Password must be at least ${minLength} characters long` };
            }
            if (!hasUpperCase) {
                return { isValid: false, message: 'Password must contain at least one uppercase letter (A-Z)' };
            }
            if (!hasLowerCase) {
                return { isValid: false, message: 'Password must contain at least one lowercase letter (a-z)' };
            }
            if (!hasNumbers) {
                return { isValid: false, message: 'Password must contain at least one number (0-9)' };
            }
            if (!hasSpecialChar) {
                return { isValid: false, message: 'Password must contain at least one special character (!@#$%^&*)' };
            }

            return { isValid: true, message: 'Password is strong' };
        }

        // Update password requirements UI in real-time (for signup)
        window.updatePasswordRequirements = () => {
            const password = document.getElementById('signupPassword')?.value || '';
            
            // Update requirement indicators
            const reqLength = document.getElementById('signup-req-length');
            const reqUpper = document.getElementById('signup-req-upper');
            const reqLower = document.getElementById('signup-req-lower');
            const reqNumber = document.getElementById('signup-req-number');
            const reqSpecial = document.getElementById('signup-req-special');
            
            if (reqLength) reqLength.classList.toggle('met', password.length >= 8);
            if (reqUpper) reqUpper.classList.toggle('met', /[A-Z]/.test(password));
            if (reqLower) reqLower.classList.toggle('met', /[a-z]/.test(password));
            if (reqNumber) reqNumber.classList.toggle('met', /\d/.test(password));
            if (reqSpecial) reqSpecial.classList.toggle('met', /[!@#$%^&*(),.?":{}|<>]/.test(password));
            
            // Update strength bar
            const strengthFill = document.getElementById('signupPasswordStrengthFill');
            if (strengthFill) {
                let strength = 0;
                if (password.length >= 8) strength++;
                if (/[A-Z]/.test(password)) strength++;
                if (/[a-z]/.test(password)) strength++;
                if (/\d/.test(password)) strength++;
                if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;
                
                strengthFill.className = 'password-strength-fill';
                if (password.length === 0) {
                    strengthFill.style.width = '0%';
                } else if (strength <= 2) {
                    strengthFill.classList.add('weak');
                } else if (strength <= 4) {
                    strengthFill.classList.add('medium');
                } else {
                    strengthFill.classList.add('strong');
                }
            }
        };

        window.toggleMenu = () => { const m = document.getElementById("sideMenu"); m.style.width = m.style.width === "250px" ? "0" : "250px"; };
        // Every menu item (Sign In, Sign Up, About Us, Finance Calculator, Settings,
        // Sell/Edit listing) opens its own dedicated "shell" page that just auto-opens
        // one modal on load (see the whenReady() calls at the bottom of those files).
        // Closing that modal must send the user back to the homepage, otherwise the
        // address bar keeps pointing at that page forever even though the modal is
        // gone. On every other page (e.g. opening the same modal from index.html)
        // closing it should just hide it in place, so we only redirect when the
        // current page IS that modal's own dedicated page.
        const MODAL_HOME_PAGE = {
            signInModal: 'signin',
            signupModal: 'signup',
            aboutModal: 'about',
            financeCalculatorModal: 'finance',
            settingsModal: 'settings',
            uploadModal: 'sell',
            editModal: 'sell'
        };
        window.closeModal = (id) => {
            const el = document.getElementById(id);
            if (el) el.style.display = "none";
            const slug = MODAL_HOME_PAGE[id];
            if (slug && new RegExp('/' + slug + '(\\.html)?/?$', 'i').test(location.pathname)) {
                location.href = 'index.html';
            }
        };
        
        // Finance Calculator Functions
        window.openFinanceCalculator = () => {
            document.getElementById('financeCalculatorModal').style.display = 'flex';
            // Auto-calculate with default values when modal opens
            setTimeout(() => calculateLoan(), 100);
        };
        
        window.calculateLoan = () => {
            const carPrice = parseFloat(document.getElementById('financeCarPrice').value) || 0;
            const downPayment = parseFloat(document.getElementById('downPayment').value) || 0;
            const annualRate = parseFloat(document.getElementById('interestRate').value) || 0;
            const years = parseFloat(document.getElementById('loanTerm').value) || 5;
            
            // Validation checks with user feedback
            if (carPrice <= 0) {
                alert('الرجاء إدخال سعر السيارة أولاً\nPlease enter a car price first');
                document.getElementById('financeCarPrice').focus();
                document.getElementById('loanResults').style.display = 'none';
                return;
            }
            
            if (downPayment < 0) {
                alert('الدفعة المقدمة لا يمكن أن تكون سالبة\nDown payment cannot be negative');
                document.getElementById('downPayment').focus();
                return;
            }
            
            if (downPayment >= carPrice) {
                alert('الدفعة المقدمة يجب أن تكون أقل من سعر السيارة\nDown payment must be less than car price');
                document.getElementById('downPayment').focus();
                return;
            }
            
            if (annualRate < 0) {
                alert('معدل الفائدة لا يمكن أن يكون سالباً\nInterest rate cannot be negative');
                document.getElementById('interestRate').focus();
                return;
            }
            
            // Calculate loan amount
            const loanAmount = carPrice - downPayment;
            
            // Convert annual rate to monthly rate
            const monthlyRate = annualRate / 100 / 12;
            const numberOfPayments = years * 12;
            
            let monthlyPayment;
            if (monthlyRate === 0) {
                // No interest case
                monthlyPayment = loanAmount / numberOfPayments;
            } else {
                // Standard loan formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
                monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                                (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
            }
            
            const totalPayment = monthlyPayment * numberOfPayments;
            const totalInterest = totalPayment - loanAmount;
            
            // Update the display
            document.getElementById('monthlyPayment').textContent = '$' + monthlyPayment.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            document.getElementById('totalInterest').textContent = '$' + totalInterest.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            document.getElementById('loanAmount').textContent = '$' + loanAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            document.getElementById('totalPayment').textContent = '$' + totalPayment.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            
            // Show results with animation
            const resultsDiv = document.getElementById('loanResults');
            resultsDiv.style.display = 'block';
            resultsDiv.style.animation = 'modalSlideIn 0.4s ease-out';
        };
        
        window.setExampleValues = (price, down, rate, years) => {
            document.getElementById('financeCarPrice').value = price;
            document.getElementById('downPayment').value = down;
            document.getElementById('interestRate').value = rate;
            document.getElementById('loanTerm').value = years;
            calculateLoan();
        };
        window.openUploadModal = async () => {
            // Check if user is logged in
            if (!currentUser) {
                alert('Please sign in to post a listing');
                openSignIn();
                return;
            }
            await handleCheckoutReturn();
            if (!(await window.canPublishListing())) {
                window.openSubscriptionModal();
                return;
            }
            document.getElementById("uploadModal").style.display = "flex";
        };
        
        window.showAboutUs = () => {
            document.getElementById("aboutModal").style.display = "flex";
        };
        
        window.toggleFuelField = (val) => {
            const label = document.getElementById("fuelLabel");
            const input = document.getElementById("carFuelInfo");
            if (val === 'Electric') {
                label.innerText = "Miles per Charge";
                input.placeholder = "e.g. 300 Miles";
            } else {
                label.innerText = "Fuel Consumption";
                input.placeholder = "e.g. 8L/100km";
            }
        };

        window.handleSearch = () => { searchQuery = document.getElementById('searchInput').value.toLowerCase(); refreshUI(); };
        window.showMyCars = () => { currentFilter = 'mine'; refreshUI(); };
        window.showAllCars = () => { currentFilter = 'all'; refreshUI(); };

        window.adminLogin = async () => {
            document.getElementById('adminAuthError').style.display = 'none';
            const emailInput = document.getElementById('adminEmailInput');
            if (emailInput) {
                emailInput.value = '';
            }
            document.getElementById('adminAuthModal').style.display = 'flex';
        };

        document.getElementById('adminAuthBtn')?.addEventListener('click', async () => {
            const email = document.getElementById('adminEmailInput').value.trim();
            const password = document.getElementById('adminPasswordInput').value;
            const errorEl = document.getElementById('adminAuthError');
            const btn = document.getElementById('adminAuthBtn');

            if (!email || !password) {
                errorEl.textContent = 'Please fill in all fields';
                errorEl.style.display = 'block';
                return;
            }
            if (!auth) {
                errorEl.textContent = 'Authentication not available. Please try again later.';
                errorEl.style.display = 'block';
                return;
            }

            try {
                btn.textContent = 'Signing in...';
                btn.disabled = true;
                errorEl.style.display = 'none';

                await signInWithEmailAndPassword(auth, email, password);

                document.getElementById('adminPasswordInput').value = '';
                closeModal('adminAuthModal');

                if (!isSuperAdmin(email)) {
                    const snap = await get(ref(db, 'admin/admins/' + auth.currentUser.uid)).catch(() => null);
                    if (!snap || !snap.exists() || !snap.val()) {
                        alert('Signed in, but this account is not configured as admin.');
                    }
                }
            } catch (error) {
                console.error('Admin auth error:', error);
                errorEl.textContent = getAuthErrorMessage(error.code);
                errorEl.style.display = 'block';
            } finally {
                btn.textContent = 'SIGN IN';
                btn.disabled = false;
            }
        });

        window.adminLogout = async () => {
            try {
                await signOut(auth);
            } catch (error) {
                console.error('Admin logout error:', error);
                location.reload();
            }
        };

        window.addEventListener('DOMContentLoaded', () => {
            const titleEl = document.getElementById('siteTitle');
            if (!titleEl) return;

            let clickCount = 0;
            let clickTimer = null;

            titleEl.style.cursor = 'pointer';
            titleEl.addEventListener('click', () => {
                clickCount += 1;

                if (clickTimer) {
                    clearTimeout(clickTimer);
                }

                clickTimer = setTimeout(() => {
                    clickCount = 0;
                }, 900);

                if (clickCount >= 5) {
                    clickCount = 0;
                    adminLogin();
                }
            });
        });

        onValue(ref(db, 'cars'), (snapshot) => {
            carsData = snapshot.val() || {};
            window.__gwCarsData = carsData;
            refreshUI();
            window.__gwCarsLoaded = true;
            window.dispatchEvent(new Event('gw:cars'));
        }, (error) => {
            console.error('Failed to load cars listing:', error);
            if (isPermissionOrAuthError(error)) {
                recoverCorruptedFirebaseState('cars listener: ' + error.message);
            }
        });

        function refreshUI() {
            const grid = document.getElementById("carGrid");
            // Rebuilding the grid briefly shortens the page, which makes the
            // browser clamp the scroll position; remember it and put it back.
            const scrollBeforeRefresh = window.scrollY;
            grid.innerHTML = "";
            let keys = Object.keys(carsData).reverse();

            keys.forEach(key => {
                const car = carsData[key];
                if (searchQuery && !car.name.toLowerCase().includes(searchQuery)) return;
                if (currentFilter === 'mine' && (!currentUser || car.ownerUid !== currentUser.uid)) return;

                const isSold = (car && car.isSold === true);

                // Ensure images is always an array
                let cardImages;
                if (Array.isArray(car.images)) {
                    cardImages = car.images;
                } else if (car.images) {
                    cardImages = [car.images];
                } else {
                    cardImages = [];
                }
                
                const imageCount = cardImages.length;
                
                // Initialize card image state
                cardImageState[key] = {
                    images: cardImages,
                    index: 0
                };
                
                const card = document.createElement("div");
                card.className = "car-card";
                if (isSold) {
                    card.classList.add('sold-listing');
                }
                // Make entire card clickable except WhatsApp button
                card.onclick = (e) => {
                    // Don't open details if clicking on WhatsApp button, admin delete button, or owner buttons
                    if (e.target.closest('.BUY') || e.target.closest('.admin-btn') || e.target.closest('.owner-btn')) return;
                    viewCar(key);
                };
                card.style.cursor = 'pointer';
                card.innerHTML = `
                    ${isSold ? `<div class="sold-badge">SOLD</div>` : ''}
                    <div class="card-image-container">
                        <button class="card-nav-arrow prev" onclick="event.stopPropagation(); cardPrevImage('${key}')" ${imageCount <= 1 ? 'disabled' : ''}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                            </svg>
                        </button>
                        <img id="card-img-${key}" src="${safeAttr(cardImages[0] || '')}" alt="${safeAttr(car.name)}">
                        <button class="card-nav-arrow next" onclick="event.stopPropagation(); cardNextImage('${key}')" ${imageCount <= 1 ? 'disabled' : ''}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
                            </svg>
                        </button>
                        ${imageCount > 1 ? `<div class="card-image-counter" id="card-counter-${key}">1/${imageCount}</div>` : ''}
                    </div>
                    <h3 onclick="event.stopPropagation(); viewCar('${key}')">${escapeHtml(car.name)}</h3>
                    <div class="price-tag" onclick="event.stopPropagation(); viewCar('${key}')">$${Number(car.price).toLocaleString()}</div>
                    <button class="BUY" ${isSold ? 'disabled' : ''} ${isSold ? '' : `data-wa-phone="${safeAttr(car.phone)}" data-wa-name="${safeAttr(car.name)}" onclick="event.stopPropagation(); waFromEl(this)"`}>${isSold ? 'Sold' : 'WhatsApp Seller'}</button>
                    <button class="compare-btn ${isCompared('${key}') ? 'active' : ''}" id="compare-btn-${key}" onclick="event.stopPropagation(); toggleCompare('${key}')">${isCompared('${key}') ? 'Compared' : 'Compare'}</button>
                    ${!isListingOwner(car) && currentUser && (car.ownerUid || car.ownerId) ? `
                        <button class="follow-btn" id="follow-btn-${key}" onclick="event.stopPropagation(); toggleFollow('${car.ownerUid || car.ownerId}', this)">
                            <span style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                                <span id="follow-text-${key}">Follow Owner</span>
                            </span>
                        </button>
                    ` : ''}
                    ${!isListingOwner(car) && !currentUser && (car.ownerUid || car.ownerId) ? `
                        <button class="follow-btn" onclick="event.stopPropagation(); openSignIn()">
                            <span style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                                Follow Owner
                            </span>
                        </button>
                    ` : ''}
                    ${isListingOwner(car) ? `
                        <button onclick="event.stopPropagation(); window.editCar('${key}')" class="owner-btn edit-btn" style="background:#27ae60; border: 2px solid #2ecc71; box-shadow: 0 2px 8px rgba(46, 204, 113, 0.3);">Edit ✏️</button>
                        <button onclick="event.stopPropagation(); window.deleteCar('${key}')" class="owner-btn delete-btn" style="background:#e74c3c">Delete 🗑️</button>
                    ` : ''}
                    ${isAdmin && !isListingOwner(car) ? `<button onclick="event.stopPropagation(); window.deleteCar('${key}')" class="admin-btn" style="background:#e74c3c">Delete Listing 🗑️</button>` : ''}
                `;
                grid.appendChild(card);
            });

            updateCompareBar();
            
            // Update follow button states
            setTimeout(() => updateAllFollowButtons(), 100);

            if (scrollBeforeRefresh > 0 && window.scrollY !== scrollBeforeRefresh) {
                requestAnimationFrame(() => window.scrollTo(0, scrollBeforeRefresh));
            }
        }

        // Card image navigation state
        const cardImageState = {};

        // Initialize card images state
        window.initCardImages = (carId, images) => {
            cardImageState[carId] = {
                images: images,
                index: 0
            };
        };

        // Navigate card image to previous
        window.cardPrevImage = (carId) => {
            const state = cardImageState[carId];
            if (!state || state.images.length <= 1) return;
            
            state.index = state.index > 0 ? state.index - 1 : state.images.length - 1;
            updateCardImage(carId);
        };

        // Navigate card image to next
        window.cardNextImage = (carId) => {
            const state = cardImageState[carId];
            if (!state || state.images.length <= 1) return;
            
            state.index = state.index < state.images.length - 1 ? state.index + 1 : 0;
            updateCardImage(carId);
        };

        // Update card image display
        function updateCardImage(carId) {
            const state = cardImageState[carId];
            if (!state) return;
            
            const img = document.getElementById(`card-img-${carId}`);
            const counter = document.getElementById(`card-counter-${carId}`);
            
            if (img && state.images[state.index]) {
                img.src = state.images[state.index];
            }
            
            if (counter) {
                counter.textContent = `${state.index + 1}/${state.images.length}`;
            }
        }

        document.getElementById("publishBtn").onclick = async () => {
            // Check if user is logged in
            if (!currentUser) {
                alert('Please sign in to publish a listing');
                openSignIn();
                return;
            }
            
            if (!(await window.canPublishListing())) {
                closeModal('uploadModal');
                window.openSubscriptionModal();
                return;
            }

            const name = document.getElementById("carName").value;
            const phone = document.getElementById("carPhone").value.replace(/\D/g,'');
            const files = document.getElementById("carImages").files;

            if(!name || !phone || files.length === 0) return alert("Please fill all fields.");
            if(files.length < 7) return alert("Please upload at least 7 images for your car listing.");

            const btn = document.getElementById("publishBtn");
            btn.innerText = "Uploading..."; btn.disabled = true;

            const compress = (file) => new Promise((res, rej) => {
                const r = new FileReader(); r.readAsDataURL(file);
                r.onload = e => {
                    const img = new Image(); img.src = e.target.result;
                    img.onload = () => {
                        // Check minimum resolution (480x320)
                        if (img.width < 480 || img.height < 320) {
                            rej(new Error(`Image "${file.name}" must be at least 480×320 pixels. Current size: ${img.width}×${img.height}`));
                            return;
                        }
                        
                        const c = document.createElement('canvas');
                        c.width = 600; c.height = 400;
                        c.getContext('2d').drawImage(img, 0, 0, 600, 400);
                        res(c.toDataURL('image/jpeg', 0.6));
                    }
                }
            });

            try {
                const imgs = await Promise.all(Array.from(files).map(compress));
                await push(ref(db, 'cars'), {
                name, phone, images: imgs,
                year: document.getElementById("carYear").value,
                price: document.getElementById("carPrice").value,
                engine: document.getElementById("carEngine").value,
                gear: document.getElementById("carGear").value,
                fuel: document.getElementById("carFuel").value,
                fuelInfo: document.getElementById("carFuelInfo").value,
                accidents: document.getElementById("carAccidents").value,
                paint: document.getElementById("carPaint").value,
                firstOwner: document.getElementById("carFirstOwner").checked ? "Yes" : "No",
                ownerId: myDeviceId,
                ownerUid: currentUser ? currentUser.uid : null,
                ownerName: await getUserName(),
                ownerVerified: !!isUserVerified,
                isSold: false,
                soldAt: null,
                createdAt: Date.now()
            });

            alert("Listing Published Successfully!"); location.reload();
            } catch (error) {
                btn.innerText = "PUBLISH NOW"; btn.disabled = false;
                if (String(error && error.code) === 'PERMISSION_DENIED' || /permission_denied/i.test(String(error && error.message))) {
                    closeModal('uploadModal');
                    window.openSubscriptionModal();
                    return;
                }
                alert(error.message);
            }
        };

        // Update button event listener
        document.getElementById("updateBtn").onclick = window.updateCarListing;

        // Car Details Full Page Functions
        window.closeCarDetailsPage = () => {
            document.getElementById('carDetailsFullPage').classList.remove('active');
            document.body.style.overflow = '';
            // Reset image navigation state
            currentCarImages = [];
            currentImageIndex = 0;
        };

        // Image navigation state
        let currentCarImages = [];
        let currentImageIndex = 0;

        // Navigate to previous image
        window.prevImage = () => {
            if (currentCarImages.length > 1) {
                currentImageIndex = currentImageIndex > 0 ? currentImageIndex - 1 : currentCarImages.length - 1;
                updateCarImage();
            }
        };

        // Navigate to next image
        window.nextImage = () => {
            if (currentCarImages.length > 1) {
                currentImageIndex = currentImageIndex < currentCarImages.length - 1 ? currentImageIndex + 1 : 0;
                updateCarImage();
            }
        };

        // Go to specific image
        window.goToImage = (index) => {
            if (index >= 0 && index < currentCarImages.length) {
                currentImageIndex = index;
                updateCarImage();
            }
        };

        // Update the car image display
        function updateCarImage() {
            const mainImage = document.getElementById('carDetailsMainImage');
            const prevBtn = document.getElementById('prevImageBtn');
            const nextBtn = document.getElementById('nextImageBtn');
            const navDots = document.getElementById('imageNavDots');
            
            if (mainImage && currentCarImages.length > 0) {
                mainImage.src = currentCarImages[currentImageIndex];
            }
            
            // Update navigation buttons
            if (prevBtn) prevBtn.style.display = currentCarImages.length > 1 ? 'flex' : 'none';
            if (nextBtn) nextBtn.style.display = currentCarImages.length > 1 ? 'flex' : 'none';
            
            // Update navigation dots
            if (navDots) {
                navDots.innerHTML = '';
                for (let i = 0; i < currentCarImages.length; i++) {
                    const dot = document.createElement('div');
                    dot.className = 'nav-dot' + (i === currentImageIndex ? ' active' : '');
                    dot.onclick = () => goToImage(i);
                    navDots.appendChild(dot);
                }
            }
        }

        window.viewCar = async (id) => {
            const car = carsData[id];

            if (!car) {
                alert('Listing not found. Please refresh the page.');
                return;
            }
            
            // Ensure images is always an array
            if (Array.isArray(car.images)) {
                currentCarImages = car.images;
            } else if (car.images) {
                // Single image stored as string
                currentCarImages = [car.images];
            } else {
                currentCarImages = [];
            }
            
            // Reset to first image
            currentImageIndex = 0;
            
            // Update image display with smooth transition
            const mainImage = document.getElementById('carDetailsMainImage');
            if (mainImage && currentCarImages.length > 0) {
                mainImage.style.opacity = '0';
                setTimeout(() => {
                    mainImage.src = currentCarImages[0];
                    updateCarImage();
                    mainImage.style.opacity = '1';
                }, 150);
            }
            
            // Populate car details in full page
            document.getElementById("carDetailsTitle").textContent = car.name;
            document.getElementById("carDetailsPrice").textContent = "$" + Number(car.price).toLocaleString();

            chatCurrentCarId = id;

            const detailsIsSold = (car && car.isSold === true);

            // Status element (create if missing)
            const priceEl = document.getElementById("carDetailsPrice");
            if (priceEl) {
                let statusEl = document.getElementById('carDetailsSoldStatus');
                if (!statusEl) {
                    statusEl = document.createElement('div');
                    statusEl.id = 'carDetailsSoldStatus';
                    statusEl.style.marginTop = '8px';
                    statusEl.style.fontWeight = '800';
                    statusEl.style.color = detailsIsSold ? '#e74c3c' : '#2ecc71';
                    statusEl.style.textTransform = 'uppercase';
                    statusEl.style.letterSpacing = '0.05em';
                    priceEl.insertAdjacentElement('afterend', statusEl);
                }
                statusEl.textContent = detailsIsSold ? 'Status: SOLD' : 'Status: AVAILABLE';
                statusEl.style.color = detailsIsSold ? '#e74c3c' : '#2ecc71';
            }

            // Populate seller info (name + verified badge)
            const sellerEl = document.getElementById('carDetailsSeller');
            if (sellerEl) {
                const resolved = await resolveSellerFromCar(car);
                const sellerName = resolved && resolved.name ? String(resolved.name) : '';
                const isVerifiedListing = !!(resolved && resolved.verified === true);
                if (sellerName) {
                    sellerEl.style.display = 'flex';
                    sellerEl.innerHTML = `Seller: <span class="seller-name">${escapeHtml(sellerName)}</span>${isVerifiedListing ? '<span class="verified-badge">✅</span>' : ''}`;
                } else {
                    sellerEl.style.display = 'none';
                    sellerEl.innerHTML = '';
                }
            }
            
            // Populate car info grid
            document.getElementById("carDetailsInfoGrid").innerHTML = `
                <div class="car-details-info-item">
                    <div class="car-details-info-label">Year</div>
                    <div class="car-details-info-value">${escapeHtml(car.year || 'N/A')}</div>
                </div>
                <div class="car-details-info-item">
                    <div class="car-details-info-label">Engine</div>
                    <div class="car-details-info-value">${escapeHtml(car.engine || 'N/A')}</div>
                </div>
                <div class="car-details-info-item">
                    <div class="car-details-info-label">Transmission</div>
                    <div class="car-details-info-value">${escapeHtml(car.gear || 'N/A')}</div>
                </div>
                <div class="car-details-info-item">
                    <div class="car-details-info-label">Fuel Type</div>
                    <div class="car-details-info-value">${escapeHtml(car.fuel || 'N/A')}</div>
                </div>
                <div class="car-details-info-item">
                    <div class="car-details-info-label">${car.fuel === 'Electric' ? 'Range' : 'Consumption'}</div>
                    <div class="car-details-info-value">${escapeHtml(car.fuelInfo || 'N/A')}</div>
                </div>
                <div class="car-details-info-item">
                    <div class="car-details-info-label">Accidents</div>
                    <div class="car-details-info-value">${escapeHtml(car.accidents || 'N/A')}</div>
                </div>
                <div class="car-details-info-item">
                    <div class="car-details-info-label">Paint Status</div>
                    <div class="car-details-info-value">${escapeHtml(car.paint || 'N/A')}</div>
                </div>
                <div class="car-details-info-item">
                    <div class="car-details-info-label">1st Owner</div>
                    <div class="car-details-info-value">${escapeHtml(car.firstOwner || 'N/A')}</div>
                </div>
            `;
            
            // Set WhatsApp button
            const waBtn = document.getElementById("carDetailsWaBtn");
            waBtn.href = `https://wa.me/${String(car.phone || '').replace(/[^0-9+]/g, '')}?text=${encodeURIComponent('Hello, I saw your ' + (car.name || '') + ' on Golden Gear')}`;
            if (detailsIsSold) {
                waBtn.classList.add('disabled');
                waBtn.style.pointerEvents = 'none';
                waBtn.style.opacity = '0.6';
                waBtn.textContent = 'Sold';
            } else {
                waBtn.classList.remove('disabled');
                waBtn.style.pointerEvents = '';
                waBtn.style.opacity = '';
                waBtn.textContent = 'Contact via WhatsApp';
            }

            const chatBtn = document.getElementById('carDetailsChatBtn');
            if (chatBtn) {
                const canChat = !!(currentUser && car && car.ownerUid && currentUser.uid && currentUser.uid !== car.ownerUid);
                chatBtn.style.display = canChat ? 'block' : 'none';
            }

            const editBtn = document.getElementById('carDetailsEditBtn');
            if (editBtn) {
                const canEdit = !!(currentUser && car && car.ownerUid && currentUser.uid && currentUser.uid === car.ownerUid);
                editBtn.style.display = canEdit ? 'block' : 'none';
            }

            // Owner-only sold toggle button (create if missing)
            if (waBtn) {
                let toggleBtn = document.getElementById('carDetailsSoldToggleBtn');
                if (!toggleBtn) {
                    toggleBtn = document.createElement('button');
                    toggleBtn.id = 'carDetailsSoldToggleBtn';
                    toggleBtn.className = 'admin-btn';
                    toggleBtn.style.width = '100%';
                    toggleBtn.style.marginTop = '10px';
                    toggleBtn.style.background = '#444';
                    toggleBtn.style.border = '1px solid #333';
                    toggleBtn.style.borderRadius = '14px';
                    toggleBtn.style.padding = '12px 14px';
                    toggleBtn.style.fontWeight = '800';
                    toggleBtn.style.cursor = 'pointer';
                    waBtn.insertAdjacentElement('beforebegin', toggleBtn);
                }

                if (isListingOwner(car)) {
                    toggleBtn.style.display = 'block';
                    toggleBtn.textContent = detailsIsSold ? 'Mark as Available' : 'Mark as Sold';
                    toggleBtn.onclick = () => window.toggleSoldStatus(id);
                } else {
                    toggleBtn.style.display = 'none';
                    toggleBtn.onclick = null;
                }
            }
            
            // Find similar cars - using multiple matching criteria
            const carNameLower = car.name.toLowerCase();
            const carWords = carNameLower.split(/\s+/); // Split by spaces
            
            const otherCars = Object.entries(carsData).filter(([key, c]) => {
                // Exclude the current car
                if (key === id) return false;
                
                const cNameLower = c.name.toLowerCase();
                
                // Check for exact name match
                if (cNameLower === carNameLower) return true;
                
                // Check for partial word matches (e.g., "BMW" in "BMW M4" matches "BMW X5")
                for (const word of carWords) {
                    if (word.length > 2 && cNameLower.includes(word)) {
                        return true;
                    }
                }
                
                return false;
            });
            
            // Update other cars title with the car name
            document.getElementById("otherCarsTitle").textContent = `Other ${car.name} Cars`;
            
            // Populate other cars grid
            const otherCarsGrid = document.getElementById("otherCarsGrid");
            if (otherCars.length === 0) {
                otherCarsGrid.innerHTML = '<div class="no-other-cars">No similar cars available</div>';
            } else {
                otherCarsGrid.innerHTML = '';
                otherCars.forEach(([key, otherCar]) => {
                    const card = document.createElement("div");
                    card.className = "other-car-card";
                    card.innerHTML = `
                        <img src="${safeAttr(otherCar.images[0])}" onclick="viewCar('${key}');">
                        <div class="other-car-info">
                            <h4>${escapeHtml(otherCar.name)}</h4>
                            <div class="price">$${Number(otherCar.price).toLocaleString()}</div>
                        </div>
                    `;
                    otherCarsGrid.appendChild(card);
                });
            }
            
            // Show full page instead of modal
            document.getElementById('carDetailsFullPage').classList.add('active');
            document.body.style.overflow = 'hidden';
        };

        window.toggleSoldStatus = async (carId) => {
            if (!db) {
                alert('Database not connected');
                return;
            }
            if (!currentUser) {
                alert('Please sign in first');
                openSignIn();
                return;
            }

            const car = carsData[carId];
            if (!car) {
                alert('Listing not found');
                return;
            }
            if (!isListingOwner(car)) {
                alert('Only the account that posted this listing can mark it as sold');
                return;
            }

            const nextIsSold = !(car.isSold === true);
            const ok = confirm(nextIsSold ? 'Mark this car as SOLD?' : 'Mark this car as AVAILABLE?');
            if (!ok) return;

            try {
                await set(ref(db, `cars/${carId}/isSold`), nextIsSold);
                await set(ref(db, `cars/${carId}/soldAt`), nextIsSold ? Date.now() : null);
            } catch (error) {
                console.error('Failed to toggle sold status:', error);
                alert('Failed to update status. Please try again.');
            }
        };

        window.deleteCar = async (id) => {
            const car = carsData[id];
            if (!car) {
                alert('Listing not found');
                return;
            }
            
            // Check if user has permission to delete
            if (!isAdmin && !isListingOwner(car)) {
                alert('You can only delete your own listings');
                return;
            }
            
            if (!confirm("Delete this listing permanently?")) return;
            if (!db) {
                alert('Database not connected');
                return;
            }
            try {
                console.log('Deleting car with ID:', id);
                await remove(ref(db, `cars/${id}`));
                console.log('Car deleted successfully');
                alert('Listing deleted successfully!');
            } catch (error) {
                console.error('Error deleting car:', error);
                alert('Error deleting listing. Please try again.');
            }
        };

        // Edit car function
        // Edit car from details page
        window.editCarFromDetails = () => {
            if (!currentCarId) {
                alert('No car selected');
                return;
            }
            window.editCar(currentCarId);
        };

        window.editCar = (id) => {
            const car = carsData[id];
            if (!car) {
                alert('Listing not found');
                return;
            }
            
            // Check if user has permission to edit
            if (!isListingOwner(car)) {
                alert('You can only edit your own listings');
                return;
            }
            
            // Store current editing car ID
            window.currentEditingCarId = id;
            
            // Populate form with existing data
            document.getElementById('editCarName').value = car.name || '';
            document.getElementById('editCarYear').value = car.year || '';
            document.getElementById('editCarPrice').value = car.price || '';
            document.getElementById('editCarEngine').value = car.engine || '';
            document.getElementById('editCarGear').value = car.gear || 'Automatic';
            document.getElementById('editCarFuel').value = car.fuel || 'Petrol';
            document.getElementById('editCarFuelInfo').value = car.fuelInfo || '';
            document.getElementById('editCarAccidents').value = car.accidents || 'No Accidents';
            document.getElementById('editCarPaint').value = car.paint || 'Original Paint';
            document.getElementById('editCarPhone').value = car.phone || '';
            document.getElementById('editCarFirstOwner').checked = car.firstOwner || false;
            
            // Update fuel field label based on fuel type
            toggleEditFuelField(car.fuel || 'Petrol');
            
            // Show edit modal
            document.getElementById('editModal').style.display = 'flex';
        };

        // Toggle edit fuel field function
        window.toggleEditFuelField = (val) => {
            const label = document.getElementById('editFuelLabel');
            const input = document.getElementById('editCarFuelInfo');
            if (val === 'Electric') {
                label.textContent = 'Battery Range';
                input.placeholder = 'e.g. 400km';
            } else {
                label.textContent = 'Fuel Consumption';
                input.placeholder = 'e.g. 8L/100km';
            }
        };

        // Update car listing function
        window.updateCarListing = async () => {
            if (!window.currentEditingCarId) return;
            
            const carId = window.currentEditingCarId;
            const car = carsData[carId];
            
            if (!car) {
                alert('Listing not found');
                return;
            }
            
            // Check permissions again
            if (!isListingOwner(car)) {
                alert('You can only edit your own listings');
                return;
            }
            
            if (!db) {
                alert('Database not connected');
                return;
            }
            
            try {
                const updateBtn = document.getElementById('updateBtn');
                updateBtn.disabled = true;
                updateBtn.innerHTML = '<span class="btn-spinner"></span> Updating...';
                
                // Get form data
                const updatedData = {
                    name: document.getElementById('editCarName').value,
                    year: document.getElementById('editCarYear').value,
                    price: document.getElementById('editCarPrice').value,
                    engine: document.getElementById('editCarEngine').value,
                    gear: document.getElementById('editCarGear').value,
                    fuel: document.getElementById('editCarFuel').value,
                    fuelInfo: document.getElementById('editCarFuelInfo').value,
                    accidents: document.getElementById('editCarAccidents').value,
                    paint: document.getElementById('editCarPaint').value,
                    phone: document.getElementById('editCarPhone').value,
                    firstOwner: document.getElementById('editCarFirstOwner').checked,
                    updatedAt: Date.now()
                };
                
                // Handle image uploads if new images are selected
                const imageInput = document.getElementById('editCarImages');
                if (imageInput.files && imageInput.files.length > 0) {
                    const newImages = [];
                    for (let file of imageInput.files) {
                        const reader = new FileReader();
                        await new Promise((resolve) => {
                            reader.onload = (e) => {
                                newImages.push(e.target.result);
                                resolve();
                            };
                            reader.readAsDataURL(file);
                        });
                    }
                    
                    // Combine existing images with new ones
                    const existingImages = Array.isArray(car.images) ? car.images : (car.images ? [car.images] : []);
                    updatedData.images = [...existingImages, ...newImages];
                }
                
                // Update the car listing
                await update(ref(db, `cars/${carId}`), updatedData);
                
                console.log('Car updated successfully');
                alert('Listing updated successfully!');
                closeModal('editModal');
                window.currentEditingCarId = null;
                
            } catch (error) {
                console.error('Error updating car:', error);
                alert('Error updating listing. Please try again.');
            } finally {
                const updateBtn = document.getElementById('updateBtn');
                if (updateBtn) {
                    updateBtn.disabled = false;
                    updateBtn.innerHTML = 'UPDATE LISTING';
                }
            }
        };

        // Full Page Profile Functions
        window.openProfilePage = async () => {
            if (!currentUser) {
                alert('Please sign in to view your profile');
                openSignIn();
                return;
            }
            
            try {
                // Load user profile info for full page
                const profileFullNameEl = document.getElementById('profileFullName');
                const profileFullEmailEl = document.getElementById('profileFullEmail');
                const profileFullPhoneEl = document.getElementById('profileFullPhone');
                
                if (profileFullNameEl) profileFullNameEl.textContent = currentUser.displayName || 'User';
                if (profileFullEmailEl) profileFullEmailEl.textContent = currentUser.email || '';
                
                // Load phone from user profile
                if (currentUserProfile && currentUserProfile.phone && profileFullPhoneEl) {
                    profileFullPhoneEl.textContent = currentUserProfile.phone;
                } else if (profileFullPhoneEl) {
                    profileFullPhoneEl.textContent = 'No phone number';
                }
                
                // Load profile picture
                await loadProfilePictureForUser(currentUser.uid);
                
                // Load user listings for full page
                loadUserListingsForFullPage();
                
                // Load follow data
                try {
                    await loadFollowStats();
                } catch (error) {
                    console.error('Error loading follow stats:', error);
                }
                
                try {
                    await loadFollowers();
                } catch (error) {
                    console.error('Error loading followers:', error);
                }
                
                try {
                    await loadFollowing();
                } catch (error) {
                    console.error('Error loading following:', error);
                }
                
                try {
                    await loadFollowFeed();
                } catch (error) {
                    console.error('Error loading follow feed:', error);
                }
                
                // Show full page profile
                const profilePage = document.getElementById('profileFullPage');
                if (profilePage) {
                    profilePage.classList.add('active');
                    document.body.style.overflow = 'hidden'; // Prevent scrolling on main page
                } else {
                    console.error('Profile page element not found');
                }
            } catch (error) {
                console.error('Error opening profile page:', error);
                alert('Error opening profile page. Please try again.');
            }
        };
        
        window.closeProfilePage = () => {
            document.getElementById('profileFullPage').classList.remove('active');
            document.body.style.overflow = ''; // Re-enable scrolling
        };
        
        // Keep old modal function for backwards compatibility
        window.openProfileModal = async () => {
            // Directly open full page profile
            openProfilePage();
        };

        function loadUserListings() {
            const profileCarsGrid = document.getElementById('profileCarsGrid');
            profileCarsGrid.innerHTML = '';
            
            // Get user ID - use authenticated user ID or device ID
            const userId = currentUser ? currentUser.uid : myDeviceId;
            
            // Filter cars belonging to this user
            const userCars = Object.entries(carsData).filter(([key, car]) => {
                // Check for both authenticated user ID and device ID for backwards compatibility
                return car.ownerId === userId || car.ownerId === myDeviceId;
            }).reverse();
            
            // Update modal stats
            document.getElementById('profileListingsCount').textContent = userCars.length;
            document.getElementById('profileActiveCount').textContent = userCars.length;
            document.getElementById('profileViewsCount').textContent = Math.floor(Math.random() * 100) + userCars.length * 10; // Mock views
            
            if (userCars.length === 0) {
                profileCarsGrid.innerHTML = `
                    <div class="no-listings" style="grid-column: 1/-1;">
                        <div class="no-listings-icon">🚗</div>
                        <p>لا يوجد اي منشورات</p>
                        <button onclick="closeModal('profileModal'); openUploadModal();" class="upload-btn">أضف أول منشور لك</button>
                    </div>
                `;
                return;
            }
            
            userCars.forEach(([key, car]) => {
                const card = document.createElement("div");
                card.className = "profile-car-card";
                card.innerHTML = `
                    <img src="${safeAttr(car.images[0])}" onclick="viewCar('${key}');">
                    <div class="profile-car-info">
                        <h4>${escapeHtml(car.name)}</h4>
                        <div class="price">$${Number(car.price).toLocaleString()}</div>
                    </div>
                `;
                profileCarsGrid.appendChild(card);
            });
        }

        function loadUserListingsForFullPage() {
            const profileFullCarsGrid = document.getElementById('profileFullCarsGrid');
            if (!profileFullCarsGrid) {
                console.error('profileFullCarsGrid element not found');
                return;
            }
            profileFullCarsGrid.innerHTML = '';
            
            // Get user ID - use authenticated user ID or device ID
            const userId = currentUser ? currentUser.uid : myDeviceId;
            
            // Filter cars belonging to this user
            const userCars = Object.entries(carsData).filter(([key, car]) => {
                // Check for both authenticated user ID and device ID for backwards compatibility
                return car.ownerUid === userId || car.ownerId === myDeviceId;
            }).reverse();
            
            // Update stats
            const profileListingsCount = document.getElementById('profileListingsCount');
            const profileActiveCount = document.getElementById('profileActiveCount');
            const profileViewsCount = document.getElementById('profileViewsCount');
            
            if (profileListingsCount) profileListingsCount.textContent = userCars.length;
            if (profileActiveCount) profileActiveCount.textContent = userCars.length;
            if (profileViewsCount) profileViewsCount.textContent = Math.floor(Math.random() * 100) + userCars.length * 10; // Mock views
            
            if (userCars.length === 0) {
                profileFullCarsGrid.innerHTML = `
                    <div class="no-listings" style="grid-column: 1/-1;">
                        <div class="no-listings-icon">🚗</div>
                        <p>لا يوجد اي منشورات</p>
                        <button onclick="closeProfilePage(); openUploadModal();" class="upload-btn">أضف أول منشور لك</button>
                    </div>
                `;
                return;
            }
            
            userCars.forEach(([key, car]) => {
                const card = document.createElement("div");
                card.className = "profile-car-card";
                
                // Ensure images array exists
                const carImages = Array.isArray(car.images) ? car.images : (car.images ? [car.images] : []);
                
                card.innerHTML = `
                    <img src="${safeAttr(carImages[0] || '')}" onclick="viewCar('${key}');">
                    <div class="profile-car-info">
                        <h4>${escapeHtml(car.name || 'Unknown Car')}</h4>
                        <div class="price">$${Number(car.price || 0).toLocaleString()}</div>
                    </div>
                `;
                profileFullCarsGrid.appendChild(card);
            });
        }

        // Update auth UI to include profile pictures
        const originalUpdateAuthUI = updateAuthUI;
        updateAuthUI = async () => {
            originalUpdateAuthUI();
            
            const sideProfilePic = document.getElementById('sideProfilePic');
            if (sideProfilePic && currentUser) {
                // Try to load profile picture from Firebase or localStorage
                await loadProfilePictureForUser(currentUser.uid);
            }
        };

        // Helper function to load profile picture for a user
        async function loadProfilePictureForUser(userId) {
            if (!userId) return;
            
            // Try to load from Firebase first (most reliable for cross-device)
            if (db) {
                try {
                    const userSnapshot = await get(ref(db, 'users/' + userId));
                    const userData = userSnapshot.val();
                    
                    if (userData && userData.profilePic) {
                        console.log('Found profile picture in Firebase');
                        const userPic = userData.profilePic;
                        
                        // Update localStorage
                        localStorage.setItem('profile_pic_' + userId, userPic);
                        
                        // Update all profile pictures
                        const profileFullAvatar = document.getElementById('profileFullAvatar');
                        const profileAvatar = document.getElementById('profileAvatar');
                        const sideProfilePic = document.getElementById('sideProfilePic');
                        
                        if (profileFullAvatar) profileFullAvatar.src = userPic;
                        if (profileAvatar) profileAvatar.src = userPic;
                        if (sideProfilePic) sideProfilePic.src = userPic;
                        
                        return true; // Done, found profile picture
                    }
                } catch (error) {
                    console.log('Firebase load error, trying localStorage:', error);
                }
            }
            
            // Fallback to localStorage
            const savedPic = localStorage.getItem('profile_pic_' + userId);
            if (savedPic) {
                console.log('Found profile picture in localStorage');
                
                const profileFullAvatar = document.getElementById('profileFullAvatar');
                const profileAvatar = document.getElementById('profileAvatar');
                const sideProfilePic = document.getElementById('sideProfilePic');
                
                if (profileFullAvatar) profileFullAvatar.src = savedPic;
                if (profileAvatar) profileAvatar.src = savedPic;
                if (sideProfilePic) sideProfilePic.src = savedPic;
                
                return true;
            }
            
            return false;
        }

        // Handle profile picture change
        window.handleProfilePicChange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            if (!currentUser) {
                alert('Please sign in to change your profile picture');
                return;
            }
            
            // Check file type
            if (!file.type.match('image.*')) {
                alert('Please select an image file');
                return;
            }
            
            // Check file size (max 2MB for Firebase)
            if (file.size > 2 * 1024 * 1024) {
                alert('Image size should be less than 2MB');
                return;
            }
            
            try {
                // Show loading state
                const uploadBtn = document.querySelector('.profile-pic-upload-btn');
                if (uploadBtn) {
                    uploadBtn.innerHTML = '<div class="uploading-indicator"></div>';
                }
                
                // Read the image file
                const reader = new FileReader();
                reader.onload = async (e) => {
                    const img = new Image();
                    img.src = e.target.result;
                    img.onload = async () => {
                        // Compress image to smaller size (150x150 for Firebase efficiency)
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        // Smaller size for Firebase
                        const maxSize = 150;
                        let width = img.width;
                        let height = img.height;
                        
                        if (width > height) {
                            if (width > maxSize) {
                                height *= maxSize / width;
                                width = maxSize;
                            }
                        } else {
                            if (height > maxSize) {
                                width *= maxSize / height;
                                height = maxSize;
                            }
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // Get compressed image as data URL with lower quality
                        const compressedImage = canvas.toDataURL('image/jpeg', 0.6);
                        
                        console.log('Image size:', compressedImage.length, 'characters');
                        
                        // Save to localStorage first
                        localStorage.setItem('profile_pic_' + currentUser.uid, compressedImage);
                        
                        // Update all profile pictures on page immediately
                        const profileFullAvatar = document.getElementById('profileFullAvatar');
                        const profileAvatar = document.getElementById('profileAvatar');
                        const sideProfilePic = document.getElementById('sideProfilePic');
                        
                        if (profileFullAvatar) profileFullAvatar.src = compressedImage;
                        if (profileAvatar) profileAvatar.src = compressedImage;
                        if (sideProfilePic) sideProfilePic.src = compressedImage;
                        
                        // Now save to Firebase
                        if (db && currentUser) {
                            try {
                                const userRef = ref(db, 'users/' + currentUser.uid);
                                await set(userRef, {
                                    profilePic: compressedImage,
                                    lastUpdated: Date.now()
                                }, { merge: true });
                                
                                console.log('Profile picture saved to Firebase successfully');
                                alert('Profile picture updated successfully!');
                            } catch (dbError) {
                                console.error('Firebase save error:', dbError);
                                alert('Profile picture saved locally. Sync with server failed.');
                            }
                        } else {
                            alert('Profile picture saved locally!');
                        }
                        
                        // Restore button
                        if (uploadBtn) {
                            uploadBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="black"><path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/></svg>';
                        }
                    };
                    
                    img.onerror = () => {
                        console.error('Error loading image');
                        alert('Error loading image. Please try again.');
                        if (uploadBtn) {
                            uploadBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="black"><path d="M19 7v2.99s-1.99.01-2 0V7h-3s.01-1.99 0-2h3V2h2v3h3v2h-3zm-3 4V8h-3V5H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8h-3zM5 19l3-4 2 3 3-4 4 5H5z"/></svg>';
                        }
                    };
                };
                
                reader.onerror = () => {
                    console.error('Error reading file');
                    alert('Error reading file. Please try again.');
                };
                
                reader.readAsDataURL(file);
                
            } catch (error) {
                console.error('Error changing profile picture:', error);
                alert('Error changing profile picture. Please try again.');
            }
        };

        // Load saved profile picture on page load
        window.addEventListener('DOMContentLoaded', async () => {
            // Wait a moment for auth to initialize
            setTimeout(async () => {
                if (currentUser) {
                    await loadProfilePictureForUser(currentUser.uid);
                }
            }, 500); // Small delay to ensure auth is ready
        });

        // ==========================================
        // EMAIL CHANGE & SETTINGS FUNCTIONS
        // ==========================================

        // Global variables for email change
        let pendingEmailChange = {
            newEmail: '',
            verificationCode: ''
        };
        
        // Global variable to store user's phone number
        let currentUserPhone = '';

        // Helper function to get user's phone number from Firebase
        async function getUserPhoneNumber() {
            if (!currentUser || !db) return '';
            try {
                const userSnapshot = await get(ref(db, 'users/' + currentUser.uid));
                const userData = userSnapshot.val();
                return userData?.phone || '';
            } catch (error) {
                console.log('Error fetching user phone:', error);
                return '';
            }
        }

        // Open settings modal
        window.openSettings = async () => {
            if (!isAdmin) {
                alert('Admin access required to access settings');
                return;
            }
            
            document.getElementById('settingsModal').style.display = 'flex';
            document.getElementById('settingsError').style.display = 'none';
            document.getElementById('settingsSuccess').style.display = 'none';
            
            // Load current admin WhatsApp number
            if (db) {
                try {
                    const settingsSnapshot = await get(ref(db, 'admin/settings'));
                    const settings = settingsSnapshot.val();
                    if (settings && settings.adminEmail) {
                        document.getElementById('adminEmailSetting').value = settings.adminEmail;
                    }
                    if (settings && settings.adminWhatsapp) {
                        document.getElementById('adminWhatsapp').value = settings.adminWhatsapp;
                    }
                } catch (error) {
                    console.log('Error loading settings:', error);
                }
            }
        };

        // Save settings button
        document.getElementById('saveSettingsBtn')?.addEventListener('click', async () => {
            const adminEmailSetting = document.getElementById('adminEmailSetting').value.trim();
            const whatsappNumber = document.getElementById('adminWhatsapp').value.trim();
            const errorEl = document.getElementById('settingsError');
            const successEl = document.getElementById('settingsSuccess');
            const btn = document.getElementById('saveSettingsBtn');

            if (!adminEmailSetting) {
                errorEl.textContent = 'Please enter admin email';
                errorEl.style.display = 'block';
                return;
            }

            if (!whatsappNumber) {
                errorEl.textContent = 'Please enter WhatsApp number';
                errorEl.style.display = 'block';
                return;
            }
            
            // Remove any non-digit characters
            const cleanNumber = whatsappNumber.replace(/\D/g, '');
            
            if (cleanNumber.length < 8) {
                errorEl.textContent = 'Please enter a valid WhatsApp number';
                errorEl.style.display = 'block';
                return;
            }
            
            try {
                btn.textContent = 'Saving...';
                btn.disabled = true;
                errorEl.style.display = 'none';
                
                // Save to Firebase
                await set(ref(db, 'admin/settings'), {
                    adminEmail: adminEmailSetting,
                    adminWhatsapp: cleanNumber,
                    updatedAt: Date.now()
                });

                adminEmail = adminEmailSetting;
                localStorage.setItem('admin_email', adminEmailSetting);
                
                console.log('Settings saved successfully');
                successEl.textContent = 'Settings saved successfully!';
                successEl.style.display = 'block';
                
                setTimeout(() => {
                    closeModal('settingsModal');
                }, 1500);
                
            } catch (error) {
                console.error('Error saving settings:', error);
                errorEl.textContent = 'Error saving settings. Please try again.';
                errorEl.style.display = 'block';
            } finally {
                btn.textContent = 'SAVE SETTINGS';
                btn.disabled = false;
            }
        });

        // Open change email modal
        window.openChangeEmailModal = () => {
            if (!currentUser) {
                alert('Please sign in to change your email');
                openSignIn();
                return;
            }
            
            document.getElementById('changeEmailModal').style.display = 'flex';
            document.getElementById('changeEmailError').style.display = 'none';
            document.getElementById('changeEmailSuccess').style.display = 'none';
            
            // Set current email
            document.getElementById('currentEmail').value = currentUser.email || '';
            document.getElementById('newEmail').value = '';
            document.getElementById('verificationCode').value = '';
            
            // Reset sections
            document.getElementById('requestCodeSection').style.display = 'block';
            document.getElementById('verifyCodeSection').style.display = 'none';
            
            // Reset pending change
            pendingEmailChange = {
                newEmail: '',
                verificationCode: ''
            };
        };

        // Cancel email change
        window.cancelEmailChange = () => {
            document.getElementById('requestCodeSection').style.display = 'block';
            document.getElementById('verifyCodeSection').style.display = 'none';
            document.getElementById('verificationCode').value = '';
            pendingEmailChange = {
                newEmail: '',
                verificationCode: ''
            };
        };

        // Request verification code button
        document.getElementById('requestCodeBtn')?.addEventListener('click', async () => {
            const newEmail = document.getElementById('newEmail').value.trim();
            const errorEl = document.getElementById('changeEmailError');
            const successEl = document.getElementById('changeEmailSuccess');
            const btn = document.getElementById('requestCodeBtn');
            
            if (!newEmail) {
                errorEl.textContent = 'Please enter new email address';
                errorEl.style.display = 'block';
                return;
            }
            
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(newEmail)) {
                errorEl.textContent = 'Please enter a valid email address';
                errorEl.style.display = 'block';
                return;
            }
            
            if (newEmail === currentUser.email) {
                errorEl.textContent = 'New email must be different from current email';
                errorEl.style.display = 'block';
                return;
            }
            
            try {
                btn.textContent = 'Requesting...';
                btn.disabled = true;
                errorEl.style.display = 'none';
                
                // Get admin WhatsApp number
                let adminWhatsapp = '';
                if (db) {
                    try {
                        const settingsSnapshot = await get(ref(db, 'admin/settings'));
                        const settings = settingsSnapshot.val();
                        adminWhatsapp = settings?.adminWhatsapp || '';
                    } catch (error) {
                        console.log('Error fetching admin settings:', error);
                    }
                }
                
                if (!adminWhatsapp) {
                    errorEl.textContent = 'Admin WhatsApp number not configured. Please contact support.';
                    errorEl.style.display = 'block';
                    btn.textContent = 'REQUEST VERIFICATION CODE';
                    btn.disabled = false;
                    return;
                }
                
                // Generate verification code
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                pendingEmailChange = {
                    newEmail: newEmail,
                    verificationCode: code
                };
                
                // Create WhatsApp message
                const message = encodeURIComponent(
                    `🔐 Email Change Request\n\n` +
                    `User wants to change email from:\n${currentUser.email}\n\n` +
                    `To new email:\n${newEmail}\n\n` +
                    `Please send this code to the user:\n📱 CODE: ${code}`
                );
                
const waLink = `https://wa.me/${adminWhatsapp}?text=${message}`;
                
                // Open WhatsApp for admin
                window.open(waLink, '_blank');
                
                // Show success and switch to verify section
                successEl.textContent = `Verification code generated! Admin has been notified via WhatsApp.`;
                successEl.style.display = 'block';
                
                setTimeout(() => {
                    document.getElementById('requestCodeSection').style.display = 'none';
                    document.getElementById('verifyCodeSection').style.display = 'block';
                    successEl.style.display = 'none';
                }, 2000);
                
            } catch (error) {
                console.error('Error requesting code:', error);
                errorEl.textContent = 'Error generating verification code. Please try again.';
                errorEl.style.display = 'block';
            } finally {
                btn.textContent = 'REQUEST VERIFICATION CODE';
                btn.disabled = false;
            }
        });

        // Verify code and change email
        document.getElementById('verifyCodeBtn')?.addEventListener('click', async () => {
            const userCode = document.getElementById('verificationCode').value.trim();
            const errorEl = document.getElementById('changeEmailError');
            const successEl = document.getElementById('changeEmailSuccess');
            const btn = document.getElementById('verifyCodeBtn');
            
            if (!userCode) {
                errorEl.textContent = 'Please enter the verification code';
                errorEl.style.display = 'block';
                return;
            }
            
            if (userCode !== pendingEmailChange.verificationCode) {
                errorEl.textContent = 'Invalid verification code. Please check with Admin.';
                errorEl.style.display = 'block';
                return;
            }
            
            try {
                btn.textContent = 'Updating email...';
                btn.disabled = true;
                errorEl.style.display = 'none';
                
                // Store the new email temporarily and reload to force re-authentication
                const newEmail = pendingEmailChange.newEmail;
                
                // Show success message
                successEl.textContent = 'Verification successful! Email will be updated after you sign out and sign in again.';
                successEl.style.display = 'block';
                
                // Save the pending email change to localStorage
                localStorage.setItem('pending_email_change', newEmail);
                localStorage.setItem('pending_email_uid', currentUser.uid);
                
                setTimeout(() => {
                    closeModal('changeEmailModal');
                    alert(`Email verified! Your email will be changed to: ${newEmail}\n\nPlease sign out and sign in again to apply the changes.`);
                    signOutUser();
                }, 2000);
                
            } catch (error) {
                console.error('Error updating email:', error);
                errorEl.textContent = 'Error updating email. Please try again.';
                errorEl.style.display = 'block';
            } finally {
                btn.textContent = 'VERIFY & CHANGE EMAIL';
                btn.disabled = false;
            }
        });

        // Check for pending email change on page load (for demo purposes)
        // In production, you would use Firebase Auth directly
        window.addEventListener('DOMContentLoaded', () => {
            const pendingEmail = localStorage.getItem('pending_email_change');
            const pendingUid = localStorage.getItem('pending_email_uid');
            
            if (pendingEmail && pendingUid && currentUser && currentUser.uid === pendingUid) {
                // User is signed in with the account that needs email change
                // This would require Firebase Admin SDK to actually update the email
                console.log('Pending email change detected:', pendingEmail);
                
                // Clear pending (in production, this would be handled by a secure backend)
                localStorage.removeItem('pending_email_change');
                localStorage.removeItem('pending_email_uid');
            }
        });
        
        // ==========================================
        // LIKES & COMMENTS FUNCTIONS
        // ==========================================
        
        // Global variables for likes and comments
        let currentCarId = null;
        let currentCarLikes = {};
        let currentCarComments = {};
        let commentsUnsubscribe = null; // Store unsubscribe function for comments listener
        
        // Get user identifier (UID for authenticated users, device ID for anonymous)
        function getUserIdentifier() {
            return currentUser ? currentUser.uid : myDeviceId;
        }

        async function resolveSellerFromCar(car) {
            if (!car) return { name: '', verified: false };

            const nameFromListing = car.ownerName ? String(car.ownerName) : '';
            const verifiedFromListing = car.ownerVerified === true;
            if (nameFromListing) {
                return { name: nameFromListing, verified: verifiedFromListing };
            }

            if (car.ownerUid && db) {
                try {
                    const userSnapshot = await get(ref(db, 'users/' + car.ownerUid));
                    const userData = userSnapshot.val();
                    const name = userData && userData.name ? String(userData.name) : '';
                    const verified = userData && userData.verified === true;
                    if (name) return { name, verified };
                } catch (e) {
                    // ignore
                }
            }
            return { name: '', verified: false };
        }
        
        // Get user name
        async function getUserName() {
            if (currentUser) {
                if (currentUser.displayName) {
                    return currentUser.displayName;
                }
                // Try to get from database
                if (db) {
                    try {
                        const userSnapshot = await get(ref(db, 'users/' + currentUser.uid));
                        const userData = userSnapshot.val();
                        if (userData && userData.name) {
                            return userData.name;
                        }
                    } catch (error) {
                        console.log('Error fetching user name:', error);
                    }
                }
            }
            return 'Anonymous User';
        }
        
        // Initialize likes and comments for a car
        window.initCarInteractions = (carId) => {
            currentCarId = carId;
            loadLikes(carId);
            loadComments(carId);
            updateCommentFormForAuthState();
        };
        
        // Toggle like for a car
        window.toggleLike = async (carId) => {
            if (!db || !currentUser) {
                // For anonymous users, use localStorage to track likes
                const userId = getUserIdentifier();
                const likeKey = `like_${carId}_${userId}`;
                const isLiked = localStorage.getItem(likeKey);
                
                if (isLiked) {
                    // Unlike
                    localStorage.removeItem(likeKey);
                    updateLikeUI(carId, false);
                    console.log('Car unliked (anonymous)');
                } else {
                    // Like
                    localStorage.setItem(likeKey, 'true');
                    updateLikeUI(carId, true);
                    console.log('Car liked (anonymous)');
                }
                return;
            }
            
            try {
                const userId = currentUser.uid;
                const likeRef = ref(db, `cars/${carId}/likes/${userId}`);
                const likeCountRef = ref(db, `cars/${carId}/likeCount`);
                
                // Check if already liked
                const likeSnapshot = await get(likeRef);
                const isLiked = likeSnapshot.exists();
                
                if (isLiked) {
                    // Unlike
                    await remove(likeRef);
                    // Decrement like count
                    const countSnapshot = await get(likeCountRef);
                    const currentCount = countSnapshot.val() || 0;
                    await set(likeCountRef, Math.max(0, currentCount - 1));
                    updateLikeUI(carId, false);
                    console.log('Car unliked');
                } else {
                    // Like
                    await set(likeRef, {
                        userId: userId,
                        timestamp: Date.now()
                    });
                    // Increment like count
                    const countSnapshot = await get(likeCountRef);
                    const currentCount = countSnapshot.val() || 0;
                    await set(likeCountRef, currentCount + 1);
                    updateLikeUI(carId, true);
                    console.log('Car liked');
                }
            } catch (error) {
                console.error('Error toggling like:', error);
            }
        };
        
        // Load likes for a car
        async function loadLikes(carId) {
            if (!db) return;
            
            try {
                // Get like count
                const countRef = ref(db, `cars/${carId}/likeCount`);
                const countSnapshot = await get(countRef);
                const likeCount = countSnapshot.val() || 0;
                
                // Update like count display
                const likeCountEl = document.getElementById('carDetailsLikeCount');
                if (likeCountEl) {
                    likeCountEl.textContent = likeCount;
                }
                
                // Check if current user has liked
                if (currentUser) {
                    const userId = currentUser.uid;
                    const likeRef = ref(db, `cars/${carId}/likes/${userId}`);
                    const likeSnapshot = await get(likeRef);
                    const isLiked = likeSnapshot.exists();
                    updateLikeUI(carId, isLiked);
                } else {
                    // Check localStorage for anonymous users
                    const userId = getUserIdentifier();
                    const likeKey = `like_${carId}_${userId}`;
                    const isLiked = localStorage.getItem(likeKey);
                    updateLikeUI(carId, !!isLiked);
                }
                
                // Subscribe to real-time updates
                subscribeToLikes(carId);
            } catch (error) {
                console.error('Error loading likes:', error);
            }
        }
        
        // Subscribe to real-time like updates
        function subscribeToLikes(carId) {
            if (!db) return;
            
            const likeCountRef = ref(db, `cars/${carId}/likeCount`);
            onValue(likeCountRef, (snapshot) => {
                const likeCount = snapshot.val() || 0;
                const likeCountEl = document.getElementById('carDetailsLikeCount');
                if (likeCountEl) {
                    likeCountEl.textContent = likeCount;
                }
            });
        }
        
        // Update like UI
        function updateLikeUI(carId, isLiked) {
            const likeBtn = document.getElementById('carDetailsLikeBtn');
            if (!likeBtn) return;
            
            if (isLiked) {
                likeBtn.classList.add('liked');
            } else {
                likeBtn.classList.remove('liked');
            }
        }
        
        // Submit a comment
        window.submitComment = async () => {
            // Ensure currentCarId is set from viewCar
            if (!currentCarId) {
                // Try to get car ID from the currently open car details page
                const carDetailsPage = document.getElementById('carDetailsFullPage');
                if (carDetailsPage && carDetailsPage.classList.contains('active')) {
                    // Try to find the current car ID from car data
                    for (const key in carsData) {
                        const titleEl = document.getElementById('carDetailsTitle');
                        if (titleEl && carsData[key].name === titleEl.textContent) {
                            currentCarId = key;
                            console.log('Retrieved currentCarId from DOM:', currentCarId);
                            break;
                        }
                    }
                }
            }
            
            if (!currentCarId) {
                console.error('Car ID not available');
                alert('Error: Could not identify the car. Please close and reopen the car details page.');
                return;
            }
            
            const commentInput = document.getElementById('commentInput');
            const commentText = commentInput.value.trim();
            
            if (!commentText) {
                alert('Please write a comment first');
                return;
            }
            
            if (!currentUser) {
                alert('Please sign in to post comments');
                openSignIn();
                return;
            }
            
            if (!db) {
                console.error('Database not available');
                alert('Error: Database not connected. Please try again later.');
                return;
            }
            
            try {
                const submitBtn = document.getElementById('submitCommentBtn');
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="btn-spinner"></span> Posting...';
                
                const userName = await getUserName();
                const userId = currentUser.uid;
                
                // Create comment object
                const commentData = {
                    userId: userId,
                    userName: userName,
                    text: commentText,
                    timestamp: Date.now()
                };
                
                // Save to Firebase
                const commentsRef = ref(db, `comments/${currentCarId}`);
                await push(commentsRef, commentData);
                
                // Clear input
                commentInput.value = '';
                
                // Note: No need to call loadComments() here - the onValue listener
                // will automatically fire and update the UI when data changes
                console.log('Comment posted successfully');
                
            } catch (error) {
                console.error('Error posting comment:', error);
                alert('Error posting comment. Please try again.');
            } finally {
                const submitBtn = document.getElementById('submitCommentBtn');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `
                        <svg viewBox="0 0 24 24">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                        Post Comment
                    `;
                }
            }
        };
        
        // Load comments for a car
        async function loadComments(carId) {
            if (!db) return;
            
            try {
                // Unsubscribe from previous listener if exists
                if (commentsUnsubscribe) {
                    commentsUnsubscribe();
                    commentsUnsubscribe = null;
                    console.log('Unsubscribed from previous comments listener');
                }
                
                const commentsRef = ref(db, `comments/${carId}`);
                const commentsList = document.getElementById('commentsList');
                const commentsCount = document.getElementById('commentsCount');
                const noComments = document.getElementById('noComments');
                
                // Set up real-time listener
                commentsUnsubscribe = onValue(commentsRef, async (snapshot) => {
                    const comments = snapshot.val();
                    console.log('Comments data received:', comments);
                    
                    if (!comments || Object.keys(comments).length === 0) {
                        // No comments
                        console.log('No comments found for car:', carId);
                        if (commentsList) commentsList.innerHTML = '';
                        if (commentsCount) commentsCount.textContent = '0';
                        if (noComments) noComments.style.display = 'block';
                        if (commentsList) commentsList.style.display = 'none';
                        currentCarComments = [];
                        return;
                    }
                    
                    // Hide no comments message
                    if (noComments) noComments.style.display = 'none';
                    if (commentsList) commentsList.style.display = 'flex';
                    
                    // Update comments count
                    const commentsArray = Object.entries(comments);
                    console.log('Total comments count:', commentsArray.length);
                    if (commentsCount) commentsCount.textContent = commentsArray.length;
                    
                    // Get user profile pictures
                    const commentsWithProfiles = await Promise.all(
                        commentsArray.map(async ([key, comment]) => {
                            const commentWithId = { id: key, ...comment };
                            
                            // Try to get user profile picture
                            if (comment.userId && db) {
                                try {
                                    const userSnapshot = await get(ref(db, 'users/' + comment.userId));
                                    const userData = userSnapshot.val();
                                    if (userData && userData.profilePic) {
                                        commentWithId.profilePic = userData.profilePic;
                                    }
                                } catch (error) {
                                    // Ignore errors - user might not exist
                                }
                            }
                            
                            return commentWithId;
                        })
                    );
                    
                    // Sort by timestamp (newest first)
                    commentsWithProfiles.sort((a, b) => b.timestamp - a.timestamp);
                    
                    // Store comments globally for showMoreComments function
                    currentCarComments = commentsWithProfiles;
                    
                    console.log('Comments with profiles:', currentCarComments.length);
                    
                    // Render comments
                    renderComments(currentCarComments);
                    
                }, (error) => {
                    console.error('Error loading comments:', error);
                });
                
                console.log('Comments listener set up for car:', carId);
                
            } catch (error) {
                console.error('Error setting up comments listener:', error);
            }
        }
        
        // Subscribe to real-time comment updates
        function subscribeToComments(carId) {
            // Already handled in loadComments with onValue
        }
        
        // Render comments in UI
        let displayedCommentsCount = 5; // Track how many comments are currently displayed
        
        function renderComments(comments, showAll = false) {
            const commentsList = document.getElementById('commentsList');
            if (!commentsList) return;
            
            // Clear the list first
            commentsList.innerHTML = '';
            
            // Determine how many comments to show
            const totalComments = comments.length;
            
            // Always show all comments when rendering (especially after adding new comment)
            const commentsToShow = totalComments;
            
            // Render comments (already sorted newest first)
            for (let i = 0; i < commentsToShow; i++) {
                const comment = comments[i];
                const commentEl = document.createElement('div');
                commentEl.className = 'comment-item';
                
                // Get initials from name
                const initials = comment.userName 
                    ? comment.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                    : '??';
                
                // Format timestamp
                const timeAgo = formatTimeAgo(comment.timestamp);
                
                // Check if current user can delete this comment
                const canDelete = currentUser && (
                    currentUser.uid === comment.userId ||
                    currentUser.uid === carsData[currentCarId]?.ownerId
                );
                
                commentEl.innerHTML = `
                    <div class="comment-item-avatar">
                        ${comment.profilePic 
                            ? `<img src="${safeAttr(comment.profilePic)}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
                            : escapeHtml(initials)
                        }
                    </div>
                    <div class="comment-item-content">
                        <div class="comment-item-header">
                            <span class="comment-item-name">${escapeHtml(comment.userName || 'Anonymous')}</span>
                            <span class="comment-item-time">${timeAgo}</span>
                            ${canDelete ? `
                                <button class="delete-comment-btn" onclick="deleteComment('${safeAttr(currentCarId)}', '${safeAttr(comment.id)}')" title="Delete comment">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                        <div class="comment-item-text">${escapeHtml(comment.text)}</div>
                    </div>
                `;
                
                commentsList.appendChild(commentEl);
            }
            
            // Add "Show More" button if there are more comments
            const showMoreBtn = document.getElementById('showMoreCommentsBtn');
            if (commentsToShow < totalComments) {
                if (!showMoreBtn) {
                    const btn = document.createElement('button');
                    btn.id = 'showMoreCommentsBtn';
                    btn.className = 'show-more-comments-btn';
                    btn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
                        </svg>
                        Show More Comments (${totalComments - commentsToShow} remaining)
                    `;
                    btn.onclick = () => showMoreComments();
                    commentsList.appendChild(btn);
                }
            } else if (showMoreBtn) {
                showMoreBtn.remove();
            }
        }
        
        // Show more comments
        window.showMoreComments = () => {
            if (currentCarComments && currentCarComments.length > displayedCommentsCount) {
                renderComments(currentCarComments, true);
            }
        };
        
        // Delete a comment
        window.deleteComment = async (carId, commentId) => {
            if (!confirm('Are you sure you want to delete this comment?')) {
                return;
            }
            
            if (!db) return;
            
            try {
                const commentRef = ref(db, `comments/${carId}/${commentId}`);
                await remove(commentRef);
                console.log('Comment deleted successfully');
            } catch (error) {
                console.error('Error deleting comment:', error);
                alert('Error deleting comment. Please try again.');
            }
        };
        
        // Update comment form based on auth state
        function updateCommentFormForAuthState() {
            const commentForm = document.getElementById('commentFormContainer');
            const loginPrompt = document.getElementById('loginPrompt');
            const commentFormAvatar = document.getElementById('commentFormAvatar');
            
            if (!commentForm || !loginPrompt) return;
            
            if (currentUser) {
                // User is logged in, show comment form
                commentForm.style.display = 'block';
                loginPrompt.style.display = 'none';
                
                // Update avatar
                loadProfilePictureForCommentForm();
            } else {
                // User not logged in, show login prompt
                commentForm.style.display = 'none';
                loginPrompt.style.display = 'block';
            }
        }
        
        // Load profile picture for comment form
        async function loadProfilePictureForCommentForm() {
            if (!currentUser) return;
            
            const avatarEl = document.getElementById('commentFormAvatar');
            if (!avatarEl) return;
            
            // Try to get profile picture
            const savedPic = localStorage.getItem('profile_pic_' + currentUser.uid);
            
            if (savedPic) {
                avatarEl.innerHTML = `<img src="${savedPic}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
            }
        }
        
        // Helper function to format time ago
        function formatTimeAgo(timestamp) {
            if (!timestamp) return 'Just now';
            
            const now = Date.now();
            const diff = now - timestamp;
            
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);
            
            if (seconds < 60) return 'Just now';
            if (minutes < 60) return `${minutes}m ago`;
            if (hours < 24) return `${hours}h ago`;
            if (days < 7) return `${days}d ago`;
            
            // Format date
            const date = new Date(timestamp);
            return date.toLocaleDateString();
        }
        
        // Helper function to escape HTML
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        function safeAttr(text) {
            return String(text == null ? '' : text)
                .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
                .replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        window.waFromEl = (el) => {
            const phone = String(el.getAttribute('data-wa-phone') || '').replace(/[^0-9+]/g, '');
            const name = el.getAttribute('data-wa-name') || '';
            if (!phone) return;
            window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent('Hello, I am interested in your ' + name), '_blank');
        };
        
        // Override viewCar to initialize likes and comments
        const originalViewCar = window.viewCar;
        window.viewCar = (id) => {
            // Set currentCarId immediately so comments can be submitted
            currentCarId = id;
            

            // Call original viewCar first
            originalViewCar(id);

            // Initialize likes and comments after a short delay to ensure DOM is ready
            setTimeout(() => {
                initCarInteractions(id);
            }, 300);
        };
        
        // Handle like button click - wrapper function that uses currentCarId
        window.handleLikeClick = () => {
            if (currentCarId) {
                console.log('Like button clicked for car:', currentCarId);
                toggleLike(currentCarId);
            } else {
                console.error('No car ID set for like button');
            }
        };
        
        // Update closeCarDetailsPage to clean up
        const originalCloseCarDetailsPage = window.closeCarDetailsPage;
        window.closeCarDetailsPage = () => {
            // Unsubscribe from comments listener
            if (commentsUnsubscribe) {
                commentsUnsubscribe();
                commentsUnsubscribe = null;
                console.log('Comments listener unsubscribed on page close');
            }
            originalCloseCarDetailsPage();
        };

        // ==========================================
        // INITIALIZATION AND ERROR HANDLING
        // ==========================================
        
        // Check if Firebase loaded properly after a delay
        window.addEventListener('load', () => {
            setTimeout(() => {
                if (!db || !auth) {
                    console.error('Firebase not fully initialized');
                    const carGrid = document.getElementById('carGrid');
                    if (carGrid && carGrid.children.length === 0) {
                        carGrid.innerHTML = `
                            <div style="text-align: center; padding: 50px; color: #888;">
                                <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                                <h2 style="color: var(--gold);">Connection Issue</h2>
                                <p>Having trouble connecting to the database.</p>
                                <button onclick="location.reload()" class="btn-gold" style="margin-top: 20px;">REFRESH PAGE</button>
                            </div>
                        `;
                    }
                }
            }, 5000);
        });

        // Global error handler
        window.addEventListener('error', (e) => {
            console.error('Global error:', e.error);
            if (e.error && e.error.message && e.error.message.includes('firebase')) {
                console.log('Firebase-related error detected. Check console for details.');
            }
        });

// Quick Filter state
        let currentQuickFilter = 'all';
        let activeFilters = {
            minPrice: null,
            maxPrice: null,
            minYear: null,
            maxYear: null,
            transmission: '',
            fuel: '',
            make: '',
            condition: ''
        };

        // Toggle Filters Panel
        window.toggleFiltersPanel = () => {
            const panel = document.getElementById('filtersPanel');
            if (panel.classList.contains('active')) {
                panel.classList.remove('active');
            } else {
                panel.classList.add('active');
            }
        };

        // Quick Filter Functions
        window.quickFilter = (filterType, btn) => {
            // Update active state on buttons
            document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentQuickFilter = filterType;
            
            // Reset main filters when using quick filters
            resetMainFilters();
            
            // Apply the quick filter
            switch(filterType) {
                case 'all':
                    activeFilters = {
                        minPrice: null,
                        maxPrice: null,
                        minYear: null,
                        maxYear: null,
                        transmission: '',
                        fuel: '',
                        make: '',
                        condition: ''
                    };
                    break;
                case 'under-50k':
                    activeFilters.minPrice = null;
                    activeFilters.maxPrice = 50000;
                    activeFilters.minYear = null;
                    activeFilters.maxYear = null;
                    break;
                case '50k-100k':
                    activeFilters.minPrice = 50000;
                    activeFilters.maxPrice = 100000;
                    activeFilters.minYear = null;
                    activeFilters.maxYear = null;
                    break;
                case 'over-100k':
                    activeFilters.minPrice = 100000;
                    activeFilters.maxPrice = null;
                    activeFilters.minYear = null;
                    activeFilters.maxYear = null;
                    break;
                case 'electric':
                    activeFilters.fuel = 'Electric';
                    break;
                case 'sport':
                    activeFilters.make = 'sport';
                    break;
                case 'suv':
                    activeFilters.make = 'suv';
                    break;
            }
            
            applyFilters();
        };

        // Reset main filter inputs
        function resetMainFilters() {
            document.getElementById('filterMinPrice').value = '';
            document.getElementById('filterMaxPrice').value = '';
            document.getElementById('filterMinYear').value = '';
            document.getElementById('filterMaxYear').value = '';
            document.getElementById('filterTransmission').value = '';
            document.getElementById('filterFuel').value = '';
            document.getElementById('filterMake').value = '';
            document.getElementById('filterCondition').value = '';
        }

        // Apply All Filters
        window.applyFilters = () => {
            // Get values from filter inputs
            const minPrice = document.getElementById('filterMinPrice').value;
            const maxPrice = document.getElementById('filterMaxPrice').value;
            const minYear = document.getElementById('filterMinYear').value;
            const maxYear = document.getElementById('filterMaxYear').value;
            const transmission = document.getElementById('filterTransmission').value;
            const fuel = document.getElementById('filterFuel').value;
            const make = document.getElementById('filterMake').value.toLowerCase();
            const condition = document.getElementById('filterCondition').value;

            // Update active filters
            if (minPrice) activeFilters.minPrice = parseInt(minPrice);
            if (maxPrice) activeFilters.maxPrice = parseInt(maxPrice);
            if (minYear) activeFilters.minYear = parseInt(minYear);
            if (maxYear) activeFilters.maxYear = parseInt(maxYear);
            if (transmission) activeFilters.transmission = transmission;
            if (fuel) activeFilters.fuel = fuel;
            if (make) activeFilters.make = make;
            if (condition) activeFilters.condition = condition;

            // Update active filters display
            updateActiveFiltersDisplay();

            // Apply filters to UI
            refreshUI();
        };

        // Reset All Filters
        window.resetFilters = () => {
            currentQuickFilter = 'all';
            activeFilters = {
                minPrice: null,
                maxPrice: null,
                minYear: null,
                maxYear: null,
                transmission: '',
                fuel: '',
                make: '',
                condition: ''
            };
            
            // Reset main filters
            resetMainFilters();
            
            // Reset quick filter buttons
            document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.quick-filter-btn').classList.add('active');
            
            // Hide active filters
            document.getElementById('activeFiltersContainer').style.display = 'none';
            
            // Refresh UI
            refreshUI();
        };

        // Clear All Filters
        window.clearAllFilters = () => {
            resetFilters();
        };

        // Update Active Filters Display
        function updateActiveFiltersDisplay() {
            const container = document.getElementById('activeFiltersContainer');
            const tagsContainer = document.getElementById('activeFiltersTags');
            tagsContainer.innerHTML = '';
            
            const hasFilters = Object.values(activeFilters).some(v => v !== null && v !== '' && v !== 0);
            
            if (!hasFilters) {
                container.style.display = 'none';
                return;
            }
            
            container.style.display = 'flex';
            
            // Create filter tags
            if (activeFilters.minPrice !== null || activeFilters.maxPrice !== null) {
                const priceText = `$${activeFilters.minPrice || 0} - $${activeFilters.maxPrice || '∞'}`;
                addFilterTag(priceText, 'price');
            }
            
            if (activeFilters.minYear !== null || activeFilters.maxYear !== null) {
                const yearText = `${activeFilters.minYear || 'Any'} - ${activeFilters.maxYear || 'Any'}`;
                addFilterTag(yearText, 'year');
            }
            
            if (activeFilters.transmission) {
                addFilterTag(activeFilters.transmission, 'transmission');
            }
            
            if (activeFilters.fuel) {
                addFilterTag(activeFilters.fuel, 'fuel');
            }
            
            if (activeFilters.make) {
                addFilterTag(activeFilters.make, 'make');
            }
            
            if (activeFilters.condition) {
                addFilterTag(activeFilters.condition, 'condition');
            }
        }

        // Add Filter Tag
        function addFilterTag(text, type) {
            const tag = document.createElement('div');
            tag.className = 'filter-tag';
            tag.innerHTML = `${escapeHtml(text)} <button onclick="removeFilter('${safeAttr(type)}')">×</button>`;
            document.getElementById('activeFiltersTags').appendChild(tag);
        }

        // Remove Single Filter
        window.removeFilter = (type) => {
            switch(type) {
                case 'price':
                    activeFilters.minPrice = null;
                    activeFilters.maxPrice = null;
                    document.getElementById('filterMinPrice').value = '';
                    document.getElementById('filterMaxPrice').value = '';
                    break;
                case 'year':
                    activeFilters.minYear = null;
                    activeFilters.maxYear = null;
                    document.getElementById('filterMinYear').value = '';
                    document.getElementById('filterMaxYear').value = '';
                    break;
                case 'transmission':
                    activeFilters.transmission = '';
                    document.getElementById('filterTransmission').value = '';
                    break;
                case 'fuel':
                    activeFilters.fuel = '';
                    document.getElementById('filterFuel').value = '';
                    break;
                case 'make':
                    activeFilters.make = '';
                    document.getElementById('filterMake').value = '';
                    break;
                case 'condition':
                    activeFilters.condition = '';
                    document.getElementById('filterCondition').value = '';
                    break;
            }
            
            // Reset quick filter if removing price filter
            if (type === 'price' || type === 'year' || type === 'fuel' || type === 'make') {
                document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
                document.querySelector('.quick-filter-btn').classList.add('active');
                currentQuickFilter = 'all';
            }
            
            updateActiveFiltersDisplay();
            refreshUI();
        };

        // Enhanced Filter Car Function
        function filterCar(car) {
            // Filter by search query (handled in refreshUI)
            
            // Filter by price
            const carPrice = parseInt(car.price) || 0;
            if (activeFilters.minPrice !== null && carPrice < activeFilters.minPrice) return false;
            if (activeFilters.maxPrice !== null && carPrice > activeFilters.maxPrice) return false;
            
            // Filter by year
            const carYear = parseInt(car.year) || 0;
            if (activeFilters.minYear !== null && carYear < activeFilters.minYear) return false;
            if (activeFilters.maxYear !== null && carYear > activeFilters.maxYear) return false;
            
            // Filter by transmission
            if (activeFilters.transmission && car.gear !== activeFilters.transmission) return false;
            
            // Filter by fuel
            if (activeFilters.fuel && car.fuel !== activeFilters.fuel) return false;
            
            // Filter by make/model
            if (activeFilters.make) {
                const carName = car.name.toLowerCase();
                const makeFilter = activeFilters.make.toLowerCase();
                
                // Special cases for quick filters
                if (makeFilter === 'sport') {
                    const sportKeywords = ['sport', 'm3', 'm4', 'm5', 'amg', 'rs', 'gt', 'cayman', 'boxster', '911', 'turbo', 'corvette', 'mustang', 'camaro'];
                    if (!sportKeywords.some(keyword => carName.includes(keyword))) return false;
                } else if (makeFilter === 'suv') {
                    const suvKeywords = ['suv', 'x5', 'x6', 'x7', 'gle', 'gla', 'glc', 'q5', 'q7', 'q8', 'cayenne', 'macan', 'tucson', 'santa', 'palisade', 'telluride', 'explorer', 'escape', 'edge'];
                    if (!suvKeywords.some(keyword => carName.includes(keyword))) return false;
                } else {
                    // Regular make filter (BMW, Mercedes, etc.)
                    if (!carName.includes(makeFilter)) return false;
                }
            }
            
            // Filter by condition
            if (activeFilters.condition && car.accidents !== activeFilters.condition) return false;
            
            return true;
        }

        // Enhanced refreshUI function
        const originalRefreshUI = refreshUI;
        refreshUI = () => {
            const grid = document.getElementById("carGrid");
            const resultsCount = document.getElementById("resultsCount");
            grid.innerHTML = "";
            let keys = Object.keys(carsData);
            let filteredCount = 0;
            let totalCount = keys.length;

            const filteredEntries = keys
                .map((key) => ({ key, car: carsData[key] }))
                .filter(({ car }) => {
                    if (!car) return false;
                    if (searchQuery && !car.name.toLowerCase().includes(searchQuery)) return false;
                    if (currentFilter === 'mine' && (!currentUser || car.ownerUid !== currentUser.uid)) return false;
                    if (!filterCar(car)) return false;
                    return true;
                });

            filteredCount = filteredEntries.length;

            filteredEntries
                .sort((a, b) => {
                    const aSold = a.car && a.car.isSold === true ? 1 : 0;
                    const bSold = b.car && b.car.isSold === true ? 1 : 0;
                    if (aSold !== bSold) return aSold - bSold;
                    const aVerified = a.car && a.car.ownerVerified === true ? 1 : 0;
                    const bVerified = b.car && b.car.ownerVerified === true ? 1 : 0;
                    if (bVerified !== aVerified) return bVerified - aVerified;
                    const aTime = typeof a.car.createdAt === 'number' ? a.car.createdAt : 0;
                    const bTime = typeof b.car.createdAt === 'number' ? b.car.createdAt : 0;
                    return bTime - aTime;
                })
                .forEach(({ key, car }) => {

                // Ensure images is always an array
                let cardImages;
                if (Array.isArray(car.images)) {
                    cardImages = car.images;
                } else if (car.images) {
                    cardImages = [car.images];
                } else {
                    cardImages = [];
                }
                
                const imageCount = cardImages.length;
                
                // Initialize card image state
                cardImageState[key] = {
                    images: cardImages,
                    index: 0
                };
                
                const card = document.createElement("div");
                const isSold = (car && car.isSold === true);
                card.className = `car-card${car && car.ownerVerified === true ? ' verified-listing' : ''}${isSold ? ' sold-listing' : ''}`;
                card.onclick = (e) => {
                    if (e.target.closest('.BUY') || e.target.closest('.admin-btn')) return;
                    viewCar(key);
                };
                card.style.cursor = 'pointer';
                card.innerHTML = `
                    ${isSold ? `<div class="sold-badge">SOLD</div>` : ''}
                    <div class="card-image-container">
                        <button class="card-nav-arrow prev" onclick="event.stopPropagation(); cardPrevImage('${key}')" ${imageCount <= 1 ? 'disabled' : ''}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
                            </svg>
                        </button>
                        <img id="card-img-${key}" src="${safeAttr(cardImages[0] || '')}" alt="${safeAttr(car.name)}">
                        <button class="card-nav-arrow next" onclick="event.stopPropagation(); cardNextImage('${key}')" ${imageCount <= 1 ? 'disabled' : ''}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/>
                            </svg>
                        </button>
                        ${imageCount > 1 ? `<div class="card-image-counter" id="card-counter-${key}">1/${imageCount}</div>` : ''}
                    </div>
                    <h3 onclick="event.stopPropagation(); viewCar('${key}')">${escapeHtml(car.name)}</h3>
                    <div class="price-tag" onclick="event.stopPropagation(); viewCar('${key}')">$${Number(car.price).toLocaleString()}</div>
                    <button class="BUY" ${isSold ? 'disabled' : ''} ${isSold ? '' : `data-wa-phone="${safeAttr(car.phone)}" data-wa-name="${safeAttr(car.name)}" onclick="event.stopPropagation(); waFromEl(this)"`}>${isSold ? 'Sold' : 'WhatsApp Seller'}</button>
                    <button class="compare-btn ${isCompared('${key}') ? 'active' : ''}" id="compare-btn-${key}" onclick="event.stopPropagation(); toggleCompare('${key}')">${isCompared('${key}') ? 'Compared' : 'Compare'}</button>
                    ${isListingOwner(car) ? `
                        <button onclick="event.stopPropagation(); window.editCar('${key}')" class="owner-btn edit-btn" style="background:#27ae60; border: 2px solid #2ecc71; box-shadow: 0 2px 8px rgba(46, 204, 113, 0.3);">Edit ✏️</button>
                        <button onclick="event.stopPropagation(); window.deleteCar('${key}')" class="owner-btn delete-btn" style="background:#e74c3c">Delete 🗑️</button>
                    ` : ''}
                    ${isAdmin && !isListingOwner(car) ? `<button onclick="event.stopPropagation(); window.deleteCar('${key}')" class="admin-btn" style="background:#e74c3c">Delete Listing 🗑️</button>` : ''}
                `;
                grid.appendChild(card);
            });

            // Update results count
            if (Object.keys(activeFilters).some(v => v !== null && v !== '') || searchQuery) {
                resultsCount.classList.add('active');
                resultsCount.innerHTML = `Showing <strong>${filteredCount}</strong> of <strong>${totalCount}</strong> cars`;
            } else {
                resultsCount.classList.remove('active');
            }

            updateCompareBar();
        };

        // Compare functionality
        compareIds = JSON.parse(localStorage.getItem('compareCars') || '[]');
        normalizeCompareIds();

        window.toggleCompare = (carId) => {
            if (!carId) return;
            normalizeCompareIds();

            if (compareIds.includes(carId)) {
                compareIds = compareIds.filter(id => id !== carId);
            } else {
                // Limit to 4 cars to keep table usable
                if (compareIds.length >= 4) {
                    alert('You can compare up to 4 cars. Remove one to add another.');
                    return;
                }
                compareIds.push(carId);
            }

            persistCompare();
            updateCompareButton(carId);
            updateCompareBar();
        };

        window.clearCompare = () => {
            compareIds = [];
            persistCompare();
            // Update any visible buttons
            document.querySelectorAll('.compare-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.compare-btn').forEach(btn => {
                if (btn) btn.textContent = 'Compare';
            });
            updateCompareBar();
            const wrap = document.getElementById('compareTableWrap');
            if (wrap) wrap.innerHTML = '';
            const hint = document.getElementById('compareHint');
            if (hint) hint.textContent = '';
        };

        function updateCompareButton(carId) {
            const btn = document.getElementById(`compare-btn-${carId}`);
            if (!btn) return;
            if (isCompared(carId)) {
                btn.classList.add('active');
                btn.textContent = 'Compared';
            } else {
                btn.classList.remove('active');
                btn.textContent = 'Compare';
            }
        }

        function updateCompareBar() {
            normalizeCompareIds();

            // Drop IDs that no longer exist in carsData
            if (carsData && typeof carsData === 'object') {
                compareIds = compareIds.filter(id => !!carsData[id]);
            }
            persistCompare();

            const bar = document.getElementById('compareBar');
            const countEl = document.getElementById('compareCount');
            const openBtn = document.getElementById('openCompareBtn');
            if (!bar || !countEl || !openBtn) return;

            const count = compareIds.length;
            if (count === 0) {
                bar.style.display = 'none';
                openBtn.disabled = true;
                countEl.textContent = 'Compare: 0';
                return;
            }

            bar.style.display = 'flex';
            countEl.textContent = `Compare: ${count}`;
            openBtn.disabled = count < 2;
        }

        window.openCompareModal = () => {
            updateCompareBar();
            const modal = document.getElementById('compareModal');
            const hint = document.getElementById('compareHint');
            const wrap = document.getElementById('compareTableWrap');
            if (!modal || !wrap || !hint) return;

            normalizeCompareIds();

            if (compareIds.length < 2) {
                hint.textContent = 'Select at least 2 cars to compare.';
                wrap.innerHTML = '';
                modal.style.display = 'flex';
                return;
            }

            hint.textContent = `Comparing ${compareIds.length} cars`;
            wrap.innerHTML = buildCompareTable(compareIds);
            modal.style.display = 'flex';
        };

        function buildCompareTable(ids) {
            const safeGet = (car, key) => {
                const val = car && car[key] !== undefined && car[key] !== null ? String(car[key]) : '';
                return val.trim() ? val : '-';
            };

            const fields = [
                { label: 'Name', key: 'name' },
                { label: 'Price', key: 'price', format: (v) => v ? `$${Number(v).toLocaleString()}` : '-' },
                { label: 'Year', key: 'year' },
                { label: 'Engine', key: 'engine' },
                { label: 'Transmission', key: 'gear' },
                { label: 'Fuel Type', key: 'fuel' },
                { label: 'Fuel Info', key: 'fuelInfo' },
                { label: 'Accidents', key: 'accidents' },
                { label: 'Paint', key: 'paint' },
                { label: 'First Owner', key: 'firstOwner' },
            ];

            const cars = ids.map(id => ({ id, car: carsData[id] })).filter(x => x.car);

            const headCols = cars.map(({ id, car }) => {
                const name = safeGet(car, 'name');
                return `<th>${escapeHtml(name)}<div style="margin-top:8px;"><button class="compare-btn active" style="width:auto; padding:8px 10px;" onclick="toggleCompare('${safeAttr(id)}'); openCompareModal();">Remove</button></div></th>`;
            }).join('');

            const rows = fields.map(f => {
                const cells = cars.map(({ car }) => {
                    const raw = safeGet(car, f.key);
                    const value = f.format ? f.format(raw) : raw;
                    return `<td>${escapeHtml(value)}</td>`;
                }).join('');
                return `<tr><td class="row-label">${f.label}</td>${cells}</tr>`;
            }).join('');

            return `
                <table class="compare-table">
                    <thead>
                        <tr>
                            <th style="min-width:180px;">Spec</th>
                            ${headCols}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            `;
        }

// Favorites functionality
        let favorites = JSON.parse(localStorage.getItem('favorites') || '{}');
        let favoritePrices = JSON.parse(localStorage.getItem('favoritePrices') || '{}');
        
        // Add to Favorites
        window.addToFavorites = (carId) => {
            if (!carId) {
                console.error('Car ID not provided');
                return;
            }
            
            // Get car data
            const car = carsData[carId];
            if (!car) {
                console.error('Car not found:', carId);
                return;
            }
            
            // Add to favorites
            favorites[carId] = {
                carId: carId,
                name: car.name,
                addedAt: Date.now(),
                targetPrice: null
            };
            
            // Save current price for price drop tracking
            favoritePrices[carId] = parseInt(car.price) || 0;
            
            // Save to localStorage
            localStorage.setItem('favorites', JSON.stringify(favorites));
            localStorage.setItem('favoritePrices', JSON.stringify(favoritePrices));
            
            // Update UI
            updateFavoriteButton(carId);
            updateFavoritesCount();
            
            // Show notification
            showNotification(`❤️ ${car.name} added to favorites!`);
            console.log('Added to favorites:', car.name);
        };
        
        // Remove from Favorites
        window.removeFromFavorites = (carId) => {
            if (!carId || !favorites[carId]) return;
            
            const carName = favorites[carId].name;
            delete favorites[carId];
            delete favoritePrices[carId];
            
            // Save to localStorage
            localStorage.setItem('favorites', JSON.stringify(favorites));
            localStorage.setItem('favoritePrices', JSON.stringify(favoritePrices));
            
            // Update UI
            updateFavoriteButton(carId);
            updateFavoritesCount();
            renderFavoritesGrid();
            
            // Show notification
            showNotification(`💔 ${carName} removed from favorites`);
            console.log('Removed from favorites:', carName);
        };
        
        // Toggle Favorites
        window.toggleFavorite = (carId) => {
            if (favorites[carId]) {
                removeFromFavorites(carId);
            } else {
                addToFavorites(carId);
            }
        };
        
        // Check if car is in favorites
        window.isFavorite = (carId) => {
            return !!favorites[carId];
        };
        
        // Update favorite button UI
        function updateFavoriteButton(carId) {
            const btn = document.getElementById(`favorite-btn-${carId}`);
            if (!btn) return;
            
            if (favorites[carId]) {
                btn.classList.add('favorited');
                btn.innerHTML = '❤️ Saved';
            } else {
                btn.classList.remove('favorited');
                btn.innerHTML = '🤍 Save';
            }
        }
        
        // Update favorites count in menu
        function updateFavoritesCount() {
            const count = Object.keys(favorites).length;
            const countEl = document.getElementById('favoritesCount');
            if (countEl) {
                countEl.textContent = count;
            }
            return count;
        }
        
        // Render favorites grid
        function renderFavoritesGrid() {
            const grid = document.getElementById('favoritesGrid');
            if (!grid) return;
            
            grid.innerHTML = '';
            
            const favoriteIds = Object.keys(favorites);
            
            if (favoriteIds.length === 0) {
                grid.innerHTML = `
                    <div class="no-favorites">
                        <div class="no-favorites-icon">💔</div>
                        <p class="no-favorites-text">No favorites yet</p>
                        <p class="no-favorites-subtext">Save cars you love to track price drops!</p>
                        <button onclick="toggleFavoritesPanel(); closeFavoritesPage();" class="btn-gold" style="margin-top: 15px;">
                            Browse Cars
                        </button>
                    </div>
                `;
                return;
            }
            
            let notificationCount = 0;
            
            favoriteIds.forEach(carId => {
                const car = carsData[carId];
                if (!car) return;
                
                const currentPrice = parseInt(car.price) || 0;
                const originalPrice = favoritePrices[carId] || currentPrice;
                const hasPriceDrop = currentPrice < originalPrice;
                const priceDropAmount = originalPrice - currentPrice;
                
                if (hasPriceDrop && priceDropAmount > 0) {
                    notificationCount++;
                }
                
                // Get car images
                let cardImages;
                if (Array.isArray(car.images)) {
                    cardImages = car.images;
                } else if (car.images) {
                    cardImages = [car.images];
                } else {
                    cardImages = [];
                }
                
                const card = document.createElement('div');
                card.className = 'favorite-car-card';
                card.innerHTML = `
                    <div class="favorite-car-image">
                        <img src="${safeAttr(cardImages[0] || '')}" alt="${safeAttr(car.name)}" onclick="viewCar('${carId}');">
                        ${hasPriceDrop ? `
                            <div class="price-drop-badge">
                                💰 Price Drop! Save $${priceDropAmount.toLocaleString()}
                            </div>
                        ` : ''}
                        <button class="remove-favorite-btn" onclick="removeFromFavorites('${carId}'); event.stopPropagation();">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                        </button>
                    </div>
                    <div class="favorite-car-info" onclick="viewCar('${carId}');">
                        <h4>${escapeHtml(car.name)}</h4>
                        <div class="favorite-price-row">
                            <span class="current-price">$${currentPrice.toLocaleString()}</span>
                            ${hasPriceDrop ? `
                                <span class="original-price">$${originalPrice.toLocaleString()}</span>
                            ` : ''}
                        </div>
                        ${hasPriceDrop ? `
                            <div class="price-drop-info">
                                🔻 Price dropped by $${priceDropAmount.toLocaleString()}
                            </div>
                        ` : `
                            <div class="tracking-info">
                                🔔 Tracking price drops
                            </div>
                        `}
                    </div>
                `;
                grid.appendChild(card);
            });
            
            // Update notification badge
            const notificationBadge = document.getElementById('favoritesNotificationBadge');
            if (notificationBadge) {
                if (notificationCount > 0) {
                    notificationBadge.style.display = 'flex';
                    notificationBadge.textContent = notificationCount;
                } else {
                    notificationBadge.style.display = 'none';
                }
            }
        }
        
        // Toggle Favorites Panel
        window.toggleFavoritesPanel = () => {
            const panel = document.getElementById('favoritesPanel');
            if (panel.classList.contains('active')) {
                panel.classList.remove('active');
                document.body.style.overflow = '';
            } else {
                panel.classList.add('active');
                document.body.style.overflow = 'hidden';
                renderFavoritesGrid();
            }
        };
        
        // Open Favorites Page
        window.openFavoritesPage = () => {
            document.getElementById('favoritesFullPage').classList.add('active');
            document.body.style.overflow = 'hidden';
            renderFavoritesGrid();
        };
        
        // Close Favorites Page
        window.closeFavoritesPage = () => {
            document.getElementById('favoritesFullPage').classList.remove('active');
            document.body.style.overflow = '';
        };
        
        // Check for price drops (can be called periodically or on page load)
        window.checkPriceDrops = () => {
            const drops = [];
            Object.keys(favorites).forEach(carId => {
                const car = carsData[carId];
                if (!car) return;
                
                const currentPrice = parseInt(car.price) || 0;
                const originalPrice = favoritePrices[carId] || currentPrice;
                
                if (currentPrice < originalPrice) {
                    drops.push({
                        carId: carId,
                        carName: car.name,
                        originalPrice: originalPrice,
                        currentPrice: currentPrice,
                        dropAmount: originalPrice - currentPrice
                    });
                }
            });
            
            if (drops.length > 0) {
                // Show notification about price drops
                const totalSavings = drops.reduce((sum, d) => sum + d.dropAmount, 0);
                showNotification(`💰 ${drops.length} car(s) dropped in price! Total savings: $${totalSavings.toLocaleString()}`);
            }
            
            return drops;
        };
        
        // Set target price for notification
        window.setTargetPrice = (carId, targetPrice) => {
            if (!favorites[carId]) return;
            
            favorites[carId].targetPrice = parseInt(targetPrice);
            localStorage.setItem('favorites', JSON.stringify(favorites));
            
            showNotification(`🎯 Target price set! We'll notify you when it drops below $${parseInt(targetPrice).toLocaleString()}`);
        };
        
        // Show notification
        function showNotification(message) {
            // Create notification element
            const notification = document.createElement('div');
            notification.className = 'notification-toast';
            notification.innerHTML = `
                <div class="notification-content">
                    <span class="notification-icon">🔔</span>
                    <span class="notification-message">${escapeHtml(message)}</span>
                </div>
            `;
            notification.style.cssText = `
                position: fixed;
                top: 90px;
                right: 20px;
                background: linear-gradient(135deg, #1e1e1e, #252525);
                border: 1px solid var(--gold);
                border-radius: 12px;
                padding: 15px 20px;
                z-index: 10000;
                animation: slideInRight 0.3s ease-out;
                box-shadow: 0 5px 20px rgba(0, 0, 0, 0.5);
                max-width: 300px;
            `;
            
            // Add animation styles if not exists
            if (!document.getElementById('notificationStyles')) {
                const style = document.createElement('style');
                style.id = 'notificationStyles';
                style.textContent = `
                    @keyframes slideInRight {
                        from {
                            opacity: 0;
                            transform: translateX(100px);
                        }
                        to {
                            opacity: 1;
                            transform: translateX(0);
                        }
                    }
                    @keyframes slideOutRight {
                        from {
                            opacity: 1;
                            transform: translateX(0);
                        }
                        to {
                            opacity: 0;
                            transform: translateX(100px);
                        }
                    }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(notification);
            
            // Auto remove after 4 seconds
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }, 4000);
        }
        
        // Update favorites on car data change
        window.addEventListener('DOMContentLoaded', () => {
            // Check for price drops when page loads
            setTimeout(() => {
                if (Object.keys(favorites).length > 0) {
                    const drops = window.checkPriceDrops();
                    if (drops.length > 0) {
                        // Show price drop notification after a short delay
                        setTimeout(() => {
                            showNotification(`💰 ${drops.length} car(s) in your favorites dropped in price!`);
                        }, 2000);
                    }
                }
            }, 3000);
        });
        
        // Initialize favorites count
        updateFavoritesCount();


/* ==========================================================
   MULTI-PAGE NAVIGATION LAYER (added for multi-page version)
   ========================================================== */
// Expose a safe getter for page-init scripts
window.getCar = (id) => (carsData ? carsData[id] : null);

// Auth readiness signal (secondary listener; Firebase allows multiple)
try {
    onAuthStateChanged(auth, (u) => {
        window.__gwAuthReady = true;
        window.__gwUser = u || null;
        window.dispatchEvent(new Event('gw:auth'));
    });
} catch (e) { window.__gwAuthReady = true; }

// Keep the in-page renderers, but turn the public actions into real page navigation
window.renderCarDetails = window.viewCar;      // in-page car details renderer
window.renderEditListing = window.editCar;     // in-page edit-form opener

window.viewCar = (id) => { location.href = 'car.html?id=' + encodeURIComponent(id); };
window.editCar = (id) => { location.href = 'sell.html?edit=' + encodeURIComponent(id); };

// Back buttons on the full-page views now go to the home page
window.closeCarDetailsPage = () => { location.href = 'index.html'; };
window.closeProfilePage = () => { location.href = 'index.html'; };

// Messages page: closing the chat modal there should return to the homepage,
// same reasoning as the other dedicated pages above.
window.closeChatModal = () => {
    cleanupChatSubscriptions();
    if (/\/messages(\.html)?\/?$/i.test(location.pathname)) {
        location.href = 'index.html';
    } else {
        closeModal('chatModal');
    }
};
window.startChatWithSeller = async () => {
    if (!currentUser) { if (window.openSignIn) window.openSignIn(); return; }
    const car = carsData[chatCurrentCarId];
    if (!car) return;
    let name = '';
    try { const r = await resolveSellerFromCar(car); name = (r && r.name) ? r.name : ''; } catch (e) {}
    const uid = car.ownerUid || car.ownerId;
    if (uid) location.href = 'messages.html?uid=' + encodeURIComponent(uid) + '&name=' + encodeURIComponent(name);
};
