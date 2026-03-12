import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Detection functions from main.tsx
const SPACING_PATTERN = /\s+/g;
const REVIEW_REQUEST_PATTERNS = [
  /requested review from/,
  /requested a review from/,
  /review request(ed)?/,
];
const APPROVED_PATTERNS = [
  /approved these changes/,
  /approved$/,
  /approved this pull request/,
];
const REVIEWED_PATTERNS = [
  /reviewed/,
];
const COMMENTED_PATTERNS = [
  /left a comment/,
  /commented/,
  /left review comments/,
];
const CHANGES_REQUESTED_PATTERNS = [
  /requested changes/,
  /request(ed)? changes?/,
];
const MERGED_PATTERNS = [
  /merged this pull request/,
  /merged commit/,
];
const BOT_SUFFIX_PATTERN = /\[bot\]$/;

function normalizeText(raw) {
  return raw.replace(SPACING_PATTERN, " ").trim().toLowerCase();
}

function isBotAccountName(name) {
  return BOT_SUFFIX_PATTERN.test(name.trim().toLowerCase());
}

function isBotTimelineItem(item) {
  if (item.querySelector("[href*='[bot]'], [data-hovercard-url*='[bot]']")) {
    return true;
  }

  const labelTexts = Array.from(
    item.querySelectorAll(".Label--secondary, .IssueLabel"),
    node => normalizeText(node.textContent || ""),
  );
  return labelTexts.includes("bot");
}

function detectEventFromText(text) {
  if (MERGED_PATTERNS.some(pattern => pattern.test(text))) {
    return "merged";
  }

  if (CHANGES_REQUESTED_PATTERNS.some(pattern => pattern.test(text))) {
    return "changes_requested";
  }

  if (REVIEWED_PATTERNS.some(pattern => pattern.test(text))) {
    return "reviewed";
  }

  if (REVIEW_REQUEST_PATTERNS.some(pattern => pattern.test(text))) {
    return "review_requested";
  }

  if (APPROVED_PATTERNS.some(pattern => pattern.test(text))) {
    return "approved";
  }

  if (COMMENTED_PATTERNS.some(pattern => pattern.test(text))) {
    return "commented";
  }

  return null;
}

function collectTimelineEvents(document) {
  const timelineItems = [...document.querySelectorAll(".js-timeline-item, .TimelineItem")];

  const events = [];
  const botEvents = [];

  for (const item of timelineItems) {
    const isBotItem = isBotTimelineItem(item);

    const text = normalizeText(item.textContent || "");
    if (!text) {
      continue;
    }

    const event = detectEventFromText(text);
    if (event) {
      if (isBotItem) {
        botEvents.push(event);
      } else {
        events.push(event);
      }
    }
  }

  return { userEvents: events, botEvents };
}

const fixturesDir = path.join(__dirname, 'fixtures');

async function runTests() {
  const htmlFiles = fs.readdirSync(fixturesDir)
    .filter(file => file.endsWith('.html'))
    .sort();

  console.log('Testing PR Detection with HTML Fixtures\n');
  console.log('='.repeat(80));

  for (const filename of htmlFiles) {
    const htmlPath = path.join(fixturesDir, filename);
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    try {
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;

      const { userEvents, botEvents } = collectTimelineEvents(document);
      const timelineItems = document.querySelectorAll('.js-timeline-item, .TimelineItem');

      console.log(`\n📄 ${filename}`);
      console.log('-'.repeat(80));
      console.log(`   Timeline items found: ${timelineItems.length}`);
      console.log(`   User events: ${userEvents.length > 0 ? userEvents.join(', ') : '(none)'}`);
      console.log(`   Bot events: ${botEvents.length > 0 ? botEvents.join(', ') : '(none)'}`);

      // Show first few timeline items for debugging
      if (timelineItems.length > 0) {
        console.log(`   Sample items:`);
        Array.from(timelineItems).slice(0, 3).forEach((item, i) => {
          const text = normalizeText(item.textContent || '');
          const isBotItem = isBotTimelineItem(item);
          const preview = text.substring(0, 70).replace(/\n/g, ' ');
          console.log(`     ${i + 1}. [${isBotItem ? 'BOT' : 'USER'}] ${preview}${text.length > 70 ? '...' : ''}`);
        });
      }
    } catch (error) {
      console.log(`\n❌ ${filename}`);
      console.log(`   Error: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

runTests().catch(console.error);
