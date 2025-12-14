(() => {
  // ---------- Config ----------
  const CARDS_URL = "./cards.json";
  const HOLD_LIMIT = 5;

  // ---------- State ----------
  const state = {
    allCards: [],
    deck: [],
    discard: [],
    current: null,
    held: [],
    pendingReshuffle: false
  };

  // ---------- Helpers ----------
  function shuffle(array) {
    // Fisher–Yates
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function isHoldCard(card) {
    return String(card.timing).toLowerCase() === "hold";
  }

  function groupBadgeClass(group) {
    const g = String(group).toLowerCase();
    if (g.includes("good")) return "badge good";
    if (g.includes("major")) return "badge majorbad";
    if (g.includes("minor")) return "badge minorbad";
    return "badge neutral";
  }

  function resetDeckKeepHeld() {
    // Exclude held cards from the reshuffle pool
    const heldIds = new Set(state.held.map(c => c.id));
    const pool = state.allCards.filter(c => !heldIds.has(c.id));
    state.deck = shuffle(pool);
    state.discard = [];
    state.current = null;
    state.pendingReshuffle = false;
  }

  function ensureDeckNotEmpty() {
    if (state.deck.length === 0) {
      // If the deck runs out, reshuffle from discard (excluding held)
      const heldIds = new Set(state.held.map(c => c.id));
      const pool = state.allCards.filter(c => !heldIds.has(c.id));
      state.deck = shuffle(pool);
      state.discard = [];
    }
  }

  // ---------- UI ----------
  function mountUI() {
    const app = document.getElementById("app");
    app.innerHTML = `
      <style>
        :root { color-scheme: dark; }
        body {
          margin: 0;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Apple Color Emoji", "Segoe UI Emoji";
          background: #0b0b0b;
          color: #eaeaea;
        }
        .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
        .top { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: stretch; }
        .panel {
          border: 2px solid #3a3a3a;
          border-radius: 10px;
          min-height: 320px;
          background: #0f0f0f;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
        }
        .panelTitle {
          position: absolute;
          top: 12px;
          left: 16px;
          font-size: 14px;
          opacity: 0.75;
        }
        .deckInfo {
          text-align: center;
          opacity: 0.9;
        }
        .bigLabel { font-size: 34px; letter-spacing: 0.5px; opacity: 0.25; }
        .metaRow { margin-top: 14px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; opacity: 0.9; }
        .pill {
          border: 1px solid #3a3a3a;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          background: #111;
        }

        .cardBox {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .cardTitle { font-size: 22px; line-height: 1.2; }
        .cardEffect { font-size: 14px; opacity: 0.9; }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          border: 1px solid #3a3a3a;
          background: #111;
        }
        .badge.neutral { }
        .badge.minorbad { }
        .badge.majorbad { }
        .badge.good { }

        .actions {
          margin: 22px 0 14px;
          display: flex;
          justify-content: center;
        }
        button {
          border: 2px solid #3a3a3a;
          background: #111;
          color: #eaeaea;
          border-radius: 10px;
          padding: 14px 22px;
          font-size: 16px;
          cursor: pointer;
        }
        button:hover { border-color: #5a5a5a; }
        button:disabled { opacity: 0.4; cursor: not-allowed; }

        .holdWrap { margin-top: 8px; }
        .holdHeader {
          text-align: center;
          opacity: 0.6;
          margin: 10px 0 12px;
          font-size: 14px;
        }
        .holdGrid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
        }
        .holdSlot {
          border: 2px solid #3a3a3a;
          border-radius: 10px;
          min-height: 150px;
          background: #0f0f0f;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          justify-content: center;
          position: relative;
        }
        .holdSlot .slotTitle {
          position: absolute;
          top: 10px;
          left: 12px;
          font-size: 12px;
          opacity: 0.6;
        }
        .holdName { font-size: 14px; line-height: 1.2; }
        .smallBtnRow { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
        .smallBtn {
          padding: 8px 10px;
          font-size: 12px;
          border-radius: 8px;
        }
        .warn {
          margin-top: 10px;
          text-align: center;
          font-size: 12px;
          opacity: 0.8;
        }
        .reshuffleFlag {
          margin-top: 10px;
          text-align: center;
          font-size: 12px;
          opacity: 0.95;
        }
      </style>

      <div class="wrap">
        <div class="top">
          <div class="panel" id="deckPanel">
            <div class="panelTitle">events deck</div>
            <div class="deckInfo">
              <div class="bigLabel">events deck</div>
              <div class="metaRow">
                <div class="pill" id="deckCountPill">Deck: —</div>
                <div class="pill" id="discardCountPill">Discard: —</div>
                <div class="pill" id="heldCountPill">Held: —</div>
              </div>
              <div class="reshuffleFlag" id="reshuffleFlag" style="display:none;"></div>
            </div>
          </div>

          <div class="panel" id="cardPanel">
            <div class="panelTitle">current card</div>
            <div id="currentCard" class="cardBox" style="opacity:0.65; text-align:center;">
              <div class="bigLabel">current card</div>
              <div class="warn">Draw a card to begin.</div>
            </div>
          </div>
        </div>

        <div class="actions">
          <button id="drawBtn">draw card</button>
        </div>

        <div class="holdWrap">
          <div class="holdHeader">cards in hold (max ${HOLD_LIMIT})</div>
          <div class="holdGrid" id="holdGrid"></div>
          <div class="warn" id="holdWarn" style="display:none;"></div>
        </div>
      </div>
    `;

    document.getElementById("drawBtn").addEventListener("click", onDraw);
    render();
  }

  function render() {
    // counts
    document.getElementById("deckCountPill").textContent = `Deck: ${state.deck.length}`;
    document.getElementById("discardCountPill").textContent = `Discard: ${state.discard.length}`;
    document.getElementById("heldCountPill").textContent = `Held: ${state.held.length}/${HOLD_LIMIT}`;

    // reshuffle notice
    const flag = document.getElementById("reshuffleFlag");
    if (state.pendingReshuffle) {
      flag.style.display = "block";
      flag.textContent = "⚠ Reshuffle is queued. Next draw resets the deck (held cards stay out).";
    } else {
      flag.style.display = "none";
      flag.textContent = "";
    }

    // current card panel
    const cur = document.getElementById("currentCard");
    if (!state.current) {
      cur.style.opacity = "0.65";
      cur.style.textAlign = "center";
      cur.innerHTML = `
        <div class="bigLabel">current card</div>
        <div class="warn">Draw a card to begin.</div>
      `;
    } else {
      cur.style.opacity = "1";
      cur.style.textAlign = "left";
      const c = state.current;

      const canHold = isHoldCard(c) && state.held.length < HOLD_LIMIT;
      const holdDisabledReason =
        !isHoldCard(c) ? "Only Hold-timing cards can be held." :
        state.held.length >= HOLD_LIMIT ? "Hold is full." :
        "";

      cur.innerHTML = `
        <div class="${groupBadgeClass(c.group)}">
          <span>${c.group}</span>
          <span style="opacity:.7;">•</span>
          <span>ID: ${escapeHtml(c.id)}</span>
          <span>${c.timing}</span>
          ${c.reshuffle ? `<span style="opacity:.7;">•</span><span>RESHUFFLE</span>` : ""}
        </div>
        <div class="cardTitle">[${escapeHtml(c.id)}] ${escapeHtml(c.name)}</div>
        <div class="cardEffect">${escapeHtml(c.effect)}</div>

        <div class="smallBtnRow" style="margin-top:12px;">
          <button class="smallBtn" id="discardBtn">discard</button>
          <button class="smallBtn" id="holdBtn" ${canHold ? "" : "disabled"}>hold</button>
        </div>

        ${(!canHold && isHoldCard(c)) ? `<div class="warn">${escapeHtml(holdDisabledReason)}</div>` : ""}
      `;

      document.getElementById("discardBtn").addEventListener("click", () => {
        discardCurrent();
        render();
      });

      const holdBtn = document.getElementById("holdBtn");
      if (holdBtn) {
        holdBtn.addEventListener("click", () => {
          holdCurrent();
          render();
        });
      }
    }

    // held cards
    const grid = document.getElementById("holdGrid");
    grid.innerHTML = "";
    for (let i = 0; i < HOLD_LIMIT; i++) {
      const slot = document.createElement("div");
      slot.className = "holdSlot";
      slot.innerHTML = `<div class="slotTitle">card in hold</div>`;

      const heldCard = state.held[i];
      if (!heldCard) {
        slot.style.opacity = "0.55";
        slot.innerHTML += `<div class="bigLabel" style="font-size:20px;">card in hold</div>`;
      } else {
        slot.style.opacity = "1";
        slot.innerHTML += `
          <div class="${groupBadgeClass(heldCard.group)}">
            <span>${heldCard.group}</span>
            <span style="opacity:.7;">•</span>
            <span>${heldCard.timing}</span>
          </div>
          <div class="holdName"><strong>[${escapeHtml(heldCard.id)}] ${escapeHtml(heldCard.name)}</strong></div>
          <div style="font-size:12px; opacity:.9;">${escapeHtml(heldCard.effect)}</div>

          <div class="smallBtnRow" style="margin-top:6px;">
            <button class="smallBtn" data-action="play" data-index="${i}">play</button>
            <button class="smallBtn" data-action="discardHeld" data-index="${i}">discard</button>
          </div>
        `;
      }

      grid.appendChild(slot);
    }

    // delegate held actions
    grid.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const action = e.currentTarget.getAttribute("data-action");
        const idx = Number(e.currentTarget.getAttribute("data-index"));
        if (Number.isNaN(idx)) return;

        if (action === "play") {
          // "Play" just discards it (you can wire this into your game engine later)
          discardHeldAt(idx);
          render();
        } else if (action === "discardHeld") {
          discardHeldAt(idx);
          render();
        }
      });
    });

    // hold warning
    const holdWarn = document.getElementById("holdWarn");
    if (state.held.length >= HOLD_LIMIT) {
      holdWarn.style.display = "block";
      holdWarn.textContent = "Hold is full. Discard/play a held card to make room.";
    } else {
      holdWarn.style.display = "none";
      holdWarn.textContent = "";
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- Game Actions ----------
  function onDraw() {
    // If the reshuffle card was drawn previously, the NEXT draw resets the deck.
    if (state.pendingReshuffle) {
      resetDeckKeepHeld();
      render();
      return;
    }

    // If there is an undiscarded current card, auto-discard it on draw
    // (So you can just keep clicking Draw.)
    if (state.current) {
      discardCurrent();
    }

    ensureDeckNotEmpty();

    const next = state.deck.shift();
    state.current = next;

    // If this card triggers reshuffle, queue it for the NEXT click
    if (next && next.reshuffle) {
      state.pendingReshuffle = true;
    }

    render();
  }

  function discardCurrent() {
    if (!state.current) return;
    state.discard.push(state.current);
    state.current = null;
  }

  function holdCurrent() {
    if (!state.current) return;
    if (!isHoldCard(state.current)) return;
    if (state.held.length >= HOLD_LIMIT) return;

    state.held.push(state.current);
    state.current = null;
  }

  function discardHeldAt(index) {
    if (index < 0 || index >= state.held.length) return;
    const [c] = state.held.splice(index, 1);
    if (c) state.discard.push(c);
  }

  // ---------- Init ----------
  async function init() {
    mountUI();
    try {
      const res = await fetch(CARDS_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load ${CARDS_URL}: ${res.status}`);
      const cards = await res.json();

      // Normalize / validate minimal fields
      state.allCards = cards.map(c => ({
        id: c.id ?? cryptoRandomId(),
        name: c.name ?? "Untitled",
        group: c.group ?? "Neutral",
        timing: c.timing ?? "Immediate",
        effect: c.effect ?? "",
        reshuffle: Boolean(c.reshuffle)
      }));

      resetDeckKeepHeld();
      render();
    } catch (err) {
      const cur = document.getElementById("currentCard");
      cur.style.opacity = "1";
      cur.style.textAlign = "left";
      cur.innerHTML = `
        <div class="badge majorbad">Error</div>
        <div class="cardTitle">Could not load cards.json</div>
        <div class="cardEffect">${escapeHtml(err.message)}</div>
        <div class="warn">Run via a local server (not file://). Example: <code>python -m http.server</code></div>
      `;
      console.error(err);
    }
  }

  function cryptoRandomId() {
    // fallback-safe
    return "C" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }

  init();
})();
