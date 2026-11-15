// A make.fun frontend: the board of open bounties and a page for each, on hash routes.
//
//   #/                the board
//   #/bounty/<slug>   one bounty
//
// window.__shotReady is false while a page loads and true once its data is on screen, so a
// screenshot script knows when to capture.

import { getBounties, getBounty } from './api.js';
import { board, bounty } from './views.js';

const app = document.getElementById('app');

async function render() {
  window.__shotReady = false;
  app.innerHTML = '<p>Loading…</p>';
  const match = location.hash.match(/^#\/bounty\/([^/]+)/);
  if (match) {
    const b = await getBounty(decodeURIComponent(match[1]));
    document.title = `${b.title} | make.fun bounties`;
    app.innerHTML = bounty(b);
  } else {
    document.title = 'make.fun bounties';
    app.innerHTML = board(await getBounties());
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

window.addEventListener('hashchange', render);
render();
