/* ============================================================
 * CULTURE MODE — same gesture, different languages
 * TRANSLATE 课题：肢体语言是跨文化翻译的载体
 * 每个手势在不同文化中承载不同含义
 * ============================================================ */

export const CULTURE_GESTURES = [
  {
    id: 'pinch',
    emoji: '🤌',
    name: 'The Pinch',
    desc: 'Thumb and fingers pinched together, hand slightly raised and waving',
    tagline: 'The gesture that asks, compliments and haggles.',
    meanings: [
      { flag: '🇮🇹', country: 'Italy', meaning: '“What do you want?” — the classic Italian question gesture' },
      { flag: '🇧🇷', country: 'Brazil', meaning: '“Good / perfect” — approval' },
      { flag: '🇪🇬', country: 'Egypt', meaning: '“Slow down / take it easy”' },
      { flag: '🇰🇷', country: 'South Korea', meaning: '“How much?” — asking about money' },
      { flag: '🇺🇸', country: 'USA', meaning: '“Wait, what?” — confused emphasis' },
    ],
    takeaway: 'The same hand shape asks a question in Rome, gives a compliment in São Paulo and haggles in Seoul.',
    keywords: ['italian gesture', 'che vuoi', 'pinch'],
  },
  {
    id: 'ok',
    emoji: '👌',
    name: 'The OK Sign',
    desc: 'Thumb and index finger forming a circle, other fingers relaxed',
    tagline: 'Approval, money and insult — at the same time.',
    meanings: [
      { flag: '🇺🇸', country: 'USA', meaning: '“OK / all good”' },
      { flag: '🇧🇷', country: 'Brazil', meaning: 'A rude insult' },
      { flag: '🇹🇷', country: 'Turkey', meaning: 'An insult' },
      { flag: '🇯🇵', country: 'Japan', meaning: '“Money / coins”' },
      { flag: '🇫🇷', country: 'France', meaning: '“Zero / worthless”' },
    ],
    takeaway: 'A circle of thumb and index finger means approval, money and nothing — depending on the border you crossed.',
    keywords: ['ok hand', 'ok sign'],
  },
  {
    id: 'thumbsup',
    emoji: '👍',
    name: 'The Thumbs Up',
    desc: 'Fist closed, thumb pointing up',
    tagline: 'The universal “like” — with dangerous exceptions.',
    meanings: [
      { flag: '🌍', country: 'Most of the world', meaning: '“Good / well done”' },
      { flag: '🇮🇷', country: 'Iran', meaning: 'An insult' },
      { flag: '🇬🇷', country: 'Greece', meaning: '“Up yours” — offensive' },
      { flag: '🇳🇬', country: 'Nigeria', meaning: 'Offensive in some contexts' },
      { flag: '🇨🇳', country: 'China', meaning: '“Great / awesome” (with the other hand too)' },
    ],
    takeaway: 'One thumb. A whole range of emotions — from praise to offense.',
    keywords: ['thumbs up'],
  },
  {
    id: 'peace',
    emoji: '✌️',
    name: 'The V Sign',
    desc: 'Index and middle fingers up, palm facing out',
    tagline: 'Peace, victory — or an insult, depending on the palm.',
    meanings: [
      { flag: '🌍', country: 'Most of the world', meaning: '“Peace / victory”' },
      { flag: '🇬🇧', country: 'UK & Australia', meaning: 'Palm inward: an insult (the “two fingers”)' },
      { flag: '🇺🇸', country: 'USA', meaning: '“Peace out” / casual goodbye' },
      { flag: '🇨🇳', country: 'China', meaning: '“Victory / cute” — the photo pose' },
      { flag: '🇯🇵', country: 'Japan', meaning: 'Popular in photos too — “peace”' },
    ],
    takeaway: 'Palm direction decides whether it is a greeting or a curse.',
    keywords: ['peace sign', 'victory'],
  },
  {
    id: 'wave',
    emoji: '👋',
    name: 'The Wave',
    desc: 'Open hand waving side to side',
    tagline: 'Hello, goodbye — or a serious offense.',
    meanings: [
      { flag: '🌍', country: 'Most of the world', meaning: '“Hello / goodbye”' },
      { flag: '🇳🇬', country: 'Nigeria', meaning: 'Palm-inward waving can be a serious insult' },
      { flag: '🇯🇵', country: 'Japan', meaning: '“Come here” is signalled palm-down, not palm-up' },
      { flag: '🇮🇹', country: 'Italy', meaning: 'Hand side-to-side: “no”' },
    ],
    takeaway: 'A friendly hello in one culture can be an offense in another.',
    keywords: ['waving', 'hello'],
  },
  {
    id: 'fist',
    emoji: '✊',
    name: 'The Fist',
    desc: 'Closed fist, raised',
    tagline: 'Solidarity, power — and sometimes threat.',
    meanings: [
      { flag: '🌍', country: 'Global', meaning: 'Solidarity / power / protest' },
      { flag: '🇮🇹', country: 'Italy', meaning: '“Good luck” (with the thumb between the fingers)' },
      { flag: '🇨🇳', country: 'China', meaning: 'Power / determination' },
      { flag: '🇺🇸', country: 'USA', meaning: '“Fist bump” — friendly greeting' },
    ],
    takeaway: 'One fist, many voices: from protest to handshake.',
    keywords: ['fist', 'fist bump'],
  },
  {
    id: 'one',
    emoji: '☝️',
    name: 'The Raised Index',
    desc: 'Index finger up, other fingers closed',
    tagline: 'One, first, wait — or “I have something to say”.',
    meanings: [
      { flag: '🌍', country: 'Global', meaning: '“One” / “first” / “wait a moment”' },
      { flag: '🇺🇸', country: 'USA', meaning: '“Hold on / let me speak” (classroom)' },
      { flag: '🇨🇳', country: 'China', meaning: '“One” — also counting' },
      { flag: '🇯🇵', country: 'Japan', meaning: '“I” / counting one' },
    ],
    takeaway: 'A single finger carries order, attention and identity.',
    keywords: ['number one', 'one'],
  },
];

/* 头部动作（点头/摇头）在不同文化中的含义 */
export const HEAD_CULTURE = [
  {
    id: 'nod',
    emoji: '🙂',
    name: 'The Nod',
    desc: 'Head moving up and down',
    meanings: [
      { flag: '🌍', country: 'Most of the world', meaning: '“Yes”' },
      { flag: '🇧🇬', country: 'Bulgaria', meaning: '“No” — the meanings are flipped!' },
      { flag: '🇬🇷', country: 'Greece', meaning: '“No” (often with a slight backward tilt)' },
      { flag: '🇮🇳', country: 'India', meaning: 'A side-to-side wobble can mean “yes / I hear you”' },
    ],
    takeaway: 'In Bulgaria, nodding says no — the same motion, the opposite answer.',
  },
  {
    id: 'shake',
    emoji: '🙅',
    name: 'The Head Shake',
    desc: 'Head moving side to side',
    meanings: [
      { flag: '🌍', country: 'Most of the world', meaning: '“No”' },
      { flag: '🇧🇬', country: 'Bulgaria', meaning: '“Yes” — flipped again!' },
      { flag: '🇮🇳', country: 'India', meaning: 'A gentle wobble can mean “yes / I agree”' },
      { flag: '🇯🇵', country: 'Japan', meaning: '“No” (often with a hand wave and a smile)' },
    ],
    takeaway: 'The same shake says no in Tokyo and yes in Sofia.',
  },
];
