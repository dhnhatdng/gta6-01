// HUD for Solara Bay: cash, health bar, wanted stars, speed, objective line,
// banners and transient messages. All DOM, updated from the game state.
export function createHud() {
  const el = (id) => document.getElementById(id);
  const cashBox = el('cashBox');
  const healthBar = el('healthBar');
  const stars = el('stars');
  const objName = document.querySelector('#objective .mname');
  const objText = el('objText');
  const speedBox = el('speedBox');
  const speedVal = el('speedVal');
  const banner = el('banner');
  const msg = el('msg');
  const crosshair = el('crosshair');
  const hud = el('hud');
  let bannerTimer = null;
  let msgTimer = null;
  let lastCash = -1, lastHealth = -1, lastStars = -1, lastObj = '';

  return {
    show() { hud.classList.remove('hidden'); },
    hide() { hud.classList.add('hidden'); },
    update(state) {
      if (state.cash !== lastCash) {
        cashBox.firstChild.textContent = `$${state.cash.toLocaleString('en-US')}`;
        lastCash = state.cash;
      }
      const hp = Math.max(0, Math.round(state.health));
      if (hp !== lastHealth) {
        healthBar.style.width = `${hp}%`;
        lastHealth = hp;
      }
      if (state.wanted !== lastStars) {
        let html = '';
        for (let i = 0; i < 5; i++) html += i < state.wanted ? '★' : '<span class="off">★</span>';
        stars.innerHTML = html;
        lastStars = state.wanted;
      }
      if (state.objective !== lastObj) {
        objText.textContent = state.objective;
        lastObj = state.objective;
      }
      objName.textContent = state.missionName;
      if (state.driving) {
        speedBox.classList.remove('hidden');
        speedVal.textContent = String(Math.round(Math.abs(state.speedKmh)));
      } else {
        speedBox.classList.add('hidden');
      }
      crosshair.style.display = state.aiming ? 'block' : 'none';
    },
    showBanner(title, sub, sticky) {
      banner.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
      banner.classList.add('show');
      if (bannerTimer) clearTimeout(bannerTimer);
      if (!sticky) bannerTimer = setTimeout(() => banner.classList.remove('show'), 2600);
    },
    showMessage(text) {
      msg.textContent = text;
      msg.style.display = 'block';
      if (msgTimer) clearTimeout(msgTimer);
      msgTimer = setTimeout(() => { msg.style.display = 'none'; }, 4200);
    },
  };
}
