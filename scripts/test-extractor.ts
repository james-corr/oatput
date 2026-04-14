import 'dotenv/config';
import { extractActionItems, regexScanForActionItems } from '../src/services/extractor';

const SAMPLE_TRANSCRIPT = `
Weekly sync — April 14, 2026

Attendees: James, Sarah, Marcus

We discussed the upcoming product launch. James will send the updated roadmap to the team by Thursday.
Sarah needs to schedule a follow-up call with the design team next week.

Action: Review the draft blog post and provide feedback by EOD tomorrow.
TODO: Book the conference room for the all-hands on Friday.

Key decisions:
- Marcus will create a new Slack channel for launch coordination.
- Follow up with legal about the privacy policy update.
- [ ] Prepare demo environment for the investor walkthrough.
- [ ] Confirm catering order for the team lunch.

1. Update the onboarding docs with the new flow.
2. Send the Q1 metrics report to stakeholders.

General notes: the team feels good about the timeline. No blockers raised.
`;

async function main() {
  console.log('=== Pass 1: Regex scan ===');
  const regexResults = regexScanForActionItems(SAMPLE_TRANSCRIPT);
  console.log(`Found ${regexResults.length} candidate(s):`);
  regexResults.forEach((r) => console.log(' -', r));

  console.log('\n=== Pass 2: Full extraction (regex + Claude) ===');
  const results = await extractActionItems(SAMPLE_TRANSCRIPT);
  console.log(`\nFinal action items (${results.length}):`);
  results.forEach((item, i) => console.log(`  ${i + 1}. ${item}`));
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
