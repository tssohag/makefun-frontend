// The two pages, each a function from API data to HTML.

import { date, esc, money, timeLeft } from './format.js';

/** The reward as it stands now: the prize plus any entry fees paid into it. */
const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee, when the bounty charges one. */
const fee = (b) => (b.entryFeeUsd ? `${money(b.entryFeeUsd)} entry fee` : '');

export function board(data) {
  const rows = data.items
    .map(
      (b) => `
      <li>
        <a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a>
        <span>${pot(b)}</span>
        <span>${fee(b)}</span>
        <span>${timeLeft(b.deadline)}</span>
        <span>${b.submissionCount} ${b.submissionCount === 1 ? 'entry' : 'entries'}</span>
      </li>`,
    )
    .join('');
  return `<h1>Open bounties</h1><ul class="board">${rows}</ul>`;
}

export function bounty(b) {
  return `
    <p><a href="#/">All bounties</a></p>
    <h1>${esc(b.title)}</h1>
    <p>${esc(b.summary)}</p>
    <dl>
      <dt>Reward</dt><dd>${pot(b)}</dd>
      ${b.entryFeeUsd ? `<dt>Entry fee</dt><dd>${money(b.entryFeeUsd)}</dd>` : ''}
      <dt>Deadline</dt><dd>${date(b.deadline)} (${timeLeft(b.deadline)})</dd>
      <dt>Entries</dt><dd>${b.submissionCount}</dd>
    </dl>
    <h2>Description</h2>
    <div class="description">${esc(b.description)}</div>`;
}
