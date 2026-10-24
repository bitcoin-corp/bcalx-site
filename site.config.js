// The ONE file to change for a new b*X site. Read by the pages (as /site.config.js) and by the Vercel functions.
// Nothing secret goes here: this file is public. Secrets and the premium address live in Vercel env (see README).
const SITE = {
  id: 'bcalx',                       // short lowercase id: storage keys, record app name, ticket salt
  name: 'bCalX',                     // brand as shown
  brandHtml: 'bCal<span class="gold">X</span>',
  origin: 'https://bcalx.com',       // canonical origin (SITE_ORIGIN env overrides on the server)
  tagline: 'Your calendar, in your wallet.',
  description: 'Import your calendar, keep every event as a private record locked to your bWalletX, and make any one public when you want.',
  ogImage: '/api/og',               // per-page images still to make (house rule)

  colours: { bg: '#000000', ink: '#f4f1e8', mute: '#9a968b', gold: '#ffd24d', card: '#0b0b0c', line: 'rgba(255,210,77,.16)' },

  // On-chain records. protocol = BRC-100 protocol id, security level 2. The wallet must PIN this protocol to this
  // site's origin (bWalletX services/pinnedProtocols.ts); pinVersion is the getVersion().pinnedProtocols value that
  // includes it. Ask the wallet team for the next number before launch.
  protocol: [2, 'bcalx records'],
  pinVersion: 0,                     // 0 = no pin yet: the page refuses real writes and offers a dry run
  premiumGbpPerItem: 0.01,           // b's premium per record (paid to BX_PREMIUM_ADDRESS, env)
  perTx: 25,                         // records per transaction (one wallet approval per transaction)
  feeSatPerKb: 100,
  maxImportBytes: 25 * 1024 * 1024,  // in-browser parse cap; the raw file never leaves the device

  labels: { item: 'event', items: 'events', library: 'Your events', importCta: 'Import your calendar' },

  // Importers shown on /studio, in order. Each is importers/<name>.js (see importers/README in the main README).
  importers: ['google-calendar-ics', 'google-takeout-zip'],

  // What the privacy page says you read. Keep it true.
  privacy: {
    reads: [
      'The calendar file you choose (.ics), read <b>inside your browser</b>. It is never uploaded to us.',
      'From each event: title, start and end time, location, description and its calendar id (UID).',
    ],
    never: ['We never see your Google account or password: you export the file yourself.'],
  },

  // Live / Coming checklist on /studio. Tick as shipped; never hide what isn't done.
  status: [
    ['Connect bWalletX', true],
    ['Your $name, paymail and avatar on your studio', true],
    ['Import a Google Calendar .ics file (in your browser)', true],
    ['Mint events as private records, one approval per batch', true],
    ['Make one, or all, public', true],
    ['Import a whole Google Takeout ZIP', false],
    ['Browse public events', false],
    ['Video walkthrough for exporting your calendar', false],
  ],

  company: { name: 'THE BITCOIN CORPORATION LTD', number: '16735102', email: 'support@bwalletx.com' },
};
export default SITE;
