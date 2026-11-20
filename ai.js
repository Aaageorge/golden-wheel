/* Golden Wheel AI: site-wide car advisor chat + AI price estimate for new listings. */
(function () {
    'use strict';

    var history = [];
    var busy = false;

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function money(n) { return '$' + Number(n || 0).toLocaleString('en-US'); }

    function carsObj() { return window.__gwCarsData || {}; }
    function inventory(limit) {
        var out = [];
        var data = carsObj();
        Object.keys(data).forEach(function (id) {
            var c = data[id];
            if (!c || c.isSold) return;
            out.push({
                id: id, name: c.name, year: c.year, price: c.price, engine: c.engine, gear: c.gear,
                fuel: c.fuel, fuelInfo: c.fuelInfo, accidents: c.accidents, paint: c.paint,
                firstOwner: c.firstOwner, ownerVerified: !!c.ownerVerified
            });
        });
        return out.slice(0, limit || 150);
    }

    function carCard(id) {
        var c = carsObj()[id];
        if (!c) return '';
        var img = c.images && c.images[0] ? '<img src="' + esc(c.images[0]) + '" alt="">' : '';
        return '<a class="gwai-car" href="car.html?id=' + encodeURIComponent(id) + '">' + img +
            '<span><strong>' + esc(c.name) + '</strong><small>' + esc(c.year) + ' · ' + esc(c.gear || '') +
            ' · ' + esc(c.fuel || '') + '</small><em>' + money(c.price) + '</em></span></a>';
    }

    function renderReply(text) {
        var html = esc(text)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        return html.replace(/\[\[car:([^\]\s]+)\]\]/g, function (_, id) { return carCard(id); });
    }

    function addMsg(role, html) {
        var box = document.getElementById('gwaiMessages');
        var el = document.createElement('div');
        el.className = 'gwai-msg gwai-' + role;
        el.innerHTML = html;
        box.appendChild(el);
        box.scrollTop = box.scrollHeight;
        return el;
    }

    async function send(text) {
        text = (text || '').trim();
        if (!text || busy) return;
        busy = true;
        var input = document.getElementById('gwaiInput');
        input.value = '';
        document.getElementById('gwaiChips').style.display = 'none';
        addMsg('user', esc(text));
        history.push({ role: 'user', content: text });
        var pending = addMsg('assistant', '<span class="gwai-typing"><i></i><i></i><i></i></span>');
        try {
            var res = await fetch('/api/ai-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history, inventory: inventory() })
            });
            var data = await res.json().catch(function () { return {}; });
            if (!res.ok || !data.reply) throw new Error(data.error || 'Something went wrong.');
            history.push({ role: 'assistant', content: data.reply });
            pending.innerHTML = renderReply(data.reply);
        } catch (e) {
            history.pop();
            pending.classList.add('gwai-error');
            pending.textContent = e.message || 'The assistant is unavailable right now.';
        } finally {
            busy = false;
            document.getElementById('gwaiMessages').scrollTop = 1e9;
            input.focus();
        }
    }

    function buildChat() {
        if (document.getElementById('gwaiFab')) return;
        var fab = document.createElement('button');
        fab.id = 'gwaiFab';
        fab.className = 'gwai-fab';
        fab.setAttribute('aria-label', 'Open Golden AI assistant');
        fab.innerHTML = '<span aria-hidden="true">✦</span> Golden AI';

        var panel = document.createElement('div');
        panel.id = 'gwaiPanel';
        panel.className = 'gwai-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Golden AI car advisor');
        panel.innerHTML =
            '<div class="gwai-head"><div><strong>✦ Golden AI</strong><small>Your personal car advisor</small></div>' +
            '<button class="gwai-close" aria-label="Close">×</button></div>' +
            '<div id="gwaiMessages" class="gwai-messages">' +
            '<div class="gwai-msg gwai-assistant">Hi! Tell me what you\'re looking for — budget, style, or how you\'ll use it — and I\'ll find the best matches in our inventory. يمكنك الكتابة بالعربية أيضًا.</div></div>' +
            '<div id="gwaiChips" class="gwai-chips">' +
            '<button>Best sports car under $100k</button>' +
            '<button>Family SUV with no accidents</button>' +
            '<button>Compare your top electric cars</button>' +
            '<button>ما هي أفضل سيارة فاخرة متوفرة؟</button></div>' +
            '<form class="gwai-form"><input id="gwaiInput" type="text" maxlength="1500" placeholder="Ask about any car..." autocomplete="off">' +
            '<button type="submit" class="btn-gold">Send</button></form>';

        document.body.appendChild(fab);
        document.body.appendChild(panel);

        fab.addEventListener('click', function () {
            panel.classList.toggle('open');
            if (panel.classList.contains('open')) document.getElementById('gwaiInput').focus();
        });
        panel.querySelector('.gwai-close').addEventListener('click', function () { panel.classList.remove('open'); });
        panel.querySelector('form').addEventListener('submit', function (e) {
            e.preventDefault();
            send(document.getElementById('gwaiInput').value);
        });
        panel.querySelectorAll('.gwai-chips button').forEach(function (b) {
            b.addEventListener('click', function () { send(b.textContent); });
        });
    }

    /* ---------- AI price estimate inside the New Listing form ---------- */
    function val(id) { var el = document.getElementById(id); return el ? (el.type === 'checkbox' ? (el.checked ? 'Yes' : 'No') : el.value) : ''; }

    function buildPriceTool() {
        var modal = document.getElementById('uploadModal');
        var anchor = document.getElementById('carImages');
        if (!modal || !anchor || document.getElementById('gwaiPriceBtn')) return;
        var label = anchor.previousElementSibling && anchor.previousElementSibling.tagName === 'LABEL' ? anchor.previousElementSibling : anchor;

        var wrap = document.createElement('div');
        wrap.className = 'gwai-price';
        wrap.innerHTML = '<button type="button" id="gwaiPriceBtn" class="gwai-price-btn">✦ Get AI price estimate</button>' +
            '<div id="gwaiPriceResult" class="gwai-price-result" aria-live="polite"></div>';
        label.parentNode.insertBefore(wrap, label);

        document.getElementById('gwaiPriceBtn').addEventListener('click', async function () {
            var btn = this;
            var out = document.getElementById('gwaiPriceResult');
            var car = {
                name: val('carName'), year: val('carYear'), price: val('carPrice'), engine: val('carEngine'),
                gear: val('carGear'), fuel: val('carFuel'), fuelInfo: val('carFuelInfo'),
                accidents: val('carAccidents'), paint: val('carPaint'), firstOwner: val('carFirstOwner')
            };
            if (!car.name.trim()) { out.innerHTML = '<p class="gwai-error">Enter the car name & model first.</p>'; return; }
            btn.disabled = true;
            btn.textContent = 'Analyzing the market…';
            out.innerHTML = '';
            try {
                var res = await fetch('/api/ai-price', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ car: car, comparables: inventory(40) })
                });
                var d = await res.json().catch(function () { return {}; });
                if (!res.ok || d.fair == null) throw new Error(d.error || 'Could not estimate a price.');
                var labels = { great: 'Great price — should sell fast', fair: 'Fairly priced', high: 'Above market', low: 'Below market — you could ask more', unknown: '' };
                out.innerHTML =
                    '<div class="gwai-price-range"><span>' + money(d.low) + '</span><strong>' + money(d.fair) + '</strong><span>' + money(d.high) + '</span></div>' +
                    (labels[d.verdict] ? '<div class="gwai-verdict gwai-v-' + esc(d.verdict) + '">' + labels[d.verdict] + '</div>' : '') +
                    '<p>' + esc(d.summary) + '</p>' +
                    (d.tips && d.tips.length ? '<ul>' + d.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
                    '<button type="button" class="gwai-use-price">Use ' + money(d.fair) + '</button>';
                out.querySelector('.gwai-use-price').addEventListener('click', function () {
                    var p = document.getElementById('carPrice');
                    if (p) p.value = d.fair;
                });
            } catch (e) {
                out.innerHTML = '<p class="gwai-error">' + esc(e.message) + '</p>';
            } finally {
                btn.disabled = false;
                btn.textContent = '✦ Get AI price estimate';
            }
        });
    }

    function init() {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'css/ai.css';
        document.head.appendChild(link);
        buildChat();
        buildPriceTool();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
