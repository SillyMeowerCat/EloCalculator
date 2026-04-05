// ==UserScript==
// @name         ELO Calculator
// @namespace    elo-calculator
// @version      1.0.0
// @description  Show ELO changes for GeoGuessr duels
// @author       Sidecans
// @match        *://*.geoguessr.com/*
// @icon         https://www.geoguessr.com/favicon.ico
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    console.log("ELO Script Started")
    // Change ts if Im wrong
    const K = 32;

    // Formula to calculate elo given two elos a and b
    const eloChange = (a, b) => { const e = 1 / (1 + 10 ** ((b - a) / 400)); return { gain: Math.round(K * (1 - e)), loss: Math.round(K * e) }; };
    const _fetch = window.fetch.bind(window);
    const players = new Map();
    // (Removed Reset) - thats why some code is missing
    // Renders elo widget thingy
    function renderPanel() {
        const el = document.getElementById('el-elo') ?? (() => {
            const d = document.createElement('div');
            d.id = 'el-elo';
            Object.assign(d.style, { position:'fixed', top:'12px', right:'12px', zIndex:'2147483647', background:'rgba(15,15,20,.92)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,.15)', borderRadius:'10px', padding:'10px 14px', color:'#fff', font:'13px/1.65 system-ui,sans-serif', minWidth:'200px', pointerEvents:'none' });
            document.body.appendChild(d);
            return d;
        })();
        // the html for thw widget
        const arr = [...players.values()];
        const rows = arr.map(me => {
            const oppElo = arr.find(o => o !== me)?.elo ?? null;
            const ch = me.elo != null && oppElo != null ? eloChange(me.elo, oppElo) : null;
            return `<div style="display:flex;justify-content:space-between;gap:14px">
                <span style="opacity:.85;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${me.nick}</span>
                <span>${me.elo ?? '?'}&nbsp;${ch ? `<span style="color:#4ade80">+${ch.gain}</span>/<span style="color:#f87171">-${ch.loss}</span>` : '…'}</span>
            </div>`;
        }).join('');
        el.innerHTML = `<div style="font:10px/1 system-ui;opacity:.4;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">ELO | +win / -loss</div>${rows}`;
    }
    // Intercepting GeoGuessr API Call
    window.fetch = async function (...args) {
        const resp = await _fetch(...args);
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '');

        if (url.includes('/api/v4/player-identities/')) {
            console.log('ELO: player-identities intercepted:', url);
            resp.clone().json().then(async data => {
                const userId = data.player?.id ?? url.split('/').pop();
                const nick = data.player?.nick ?? userId.slice(0, 8);
                console.log('ELO: player parsed:', { userId, nick, mapBefore: [...players.keys()] });
                if (players.has(userId)) {
                    console.log('ELO: known player re-fetched', userId);
                    players.delete(userId);
                } else if (players.size >= 2) {
                    const evicted = players.keys().next().value;
                    console.log('ELO: map full, resetting', evicted);
                    players.delete(evicted);
                }
                players.set(userId, { nick, elo: null });
                console.log('ELO: map error', [...players.keys()]);
                renderPanel();
                try {
                    const r = await _fetch(`https://www.geoguessr.com/api/v4/ranked-system/progress/${userId}`, { credentials: 'include' });
                    const d = await r.json();
                    console.log('ELO: rating for', nick, ':', d?.rating);
                    if (players.has(userId)) players.get(userId).elo = d?.rating ?? null;
                    renderPanel();
                } catch (e) { console.error('ELO: rating fetch failed:', e); }
            }).catch(e => console.error('ELO: identity JSON parse failed:', e));
        } else {
            console.log('ELO: fetch (ignored):');
        }

        return resp;
    };


})();
