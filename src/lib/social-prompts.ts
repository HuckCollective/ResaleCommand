/**
 * Social Media AI Prompts & Copywriting Engine
 * 
 * Single source of truth for:
 * - Subculture literary personas & tone heuristics
 * - Strict venue separation & nominative fair use rules
 * - Dynamic opening hook pools for zero-repetition fallbacks
 * - AI prompt compilation and response formatting
 * 
 * Reference: .agents/skills/social-marketing-and-drop-broadcasting/SKILL.md
 */

export interface SocialPersona {
    id: string;
    label: string;
    emoji: string;
    prompt: string;
    directives: string;
    hooks: string[];
    cta: (authorHandle: string, locationName: string) => string;
}

export interface SocialPostItemInput {
    id?: string;
    title: string;
    resalePrice?: number | string;
    brand?: string;
    category?: string;
    upc?: string;
    condition?: string;
    conditionNotes?: string;
}

export interface SocialPostOptions {
    items: SocialPostItemInput[];
    locationName: string;
    authorHandle?: string;
    platform?: 'instagram' | 'tiktok' | 'facebook' | 'threads' | 'story' | string;
    tone?: string;
    customTone?: string;
    includePrices?: boolean;
    customNotes?: string;
    hasLocationPhotos?: boolean;
    hasMeasurements?: boolean;
}

export const SOCIAL_PERSONAS: SocialPersona[] = [
    {
        id: 'lestat',
        label: 'Vampire Lestat',
        emoji: '🥀',
        prompt: 'Vampire Lestat — decadent, poetic, darkly romantic gothic aristocrat. Velvet relics, dark aesthetic curio, nocturnal allure.',
        directives: 'Sensual, decadent, darkly poetic, nocturnal aristocrat. Items are velvet relics, dark romantic artifacts, heirlooms whispered out of old New Orleans or continental European crypts. Inject visceral sensory textures: crushed velvet nap, oxidized brass filigree, heavy silver patina, dried crimson roses, and candlelight.',
        hooks: [
            '🥀 "None of us really changes over time; we only become more fully what we are."',
            '🍷 An offering to those who walk in the twilight: deep crimson silks, ornate brass filigree, and decadent curiosities unearthed for our curation.',
            '🕯️ Heavy velvet, faint perfume of dried roses, and centuries of quiet drama. Our latest cabinet of dark romantic heirlooms has been unveiled.',
            '🖤 "How do we seem to you? Do you find us very strange?" A fresh gathering of Victorian mourning relics and nocturnal grails now awaits.',
            '🥀 Velvet that swallows the low room light, cold silver holding memories of forgotten salons, and relics that refuse to rest.'
        ],
        cta: (author, location) => `🦇 Visit our shadowy corner inside ${location} before these relics vanish into the night.\n💬 Whisper in our DMs (@${author}) to claim your hold.`
    },
    {
        id: 'academia',
        label: 'Dark Academia',
        emoji: '🏛️',
        prompt: 'Dark Academia — antiquarian professor, scholarly curiosities, tweed, leather-bound books, ancient statues.',
        directives: 'Erudite, scholarly, antiquarian. Items are lost archival discoveries, esoteric oddities, philosophical relics, and curious treasures worthy of a secluded study. Inject textures: deckled paper edges, hand-bound calfskin, foxed lithographs, and brass optical gear.',
        hooks: [
            '🏛️ Emerging from the archive: rare oddities, scholarly finds, and antiquarian relics just cataloged for our study.',
            '📜 Heavy leather bindings, aged brass instruments, and quiet melancholia: fresh curiosity cabinet acquisitions are now shelved.',
            '🕰️ For those who lose track of time in candlelit reading rooms: obscure historical artifacts and philosophical oddities have surfaced.',
            '🕯️ Specimen vitrines, forgotten cartography, and timeless tweed: newly cataloged specimens are waiting for your inspection.',
            '📖 Marginalia scrawled in sepia ink, cracked spine leather, and artifacts rescued from long-shuttered campus collections.'
        ],
        cta: (author, location) => `📜 Uncover them in person at ${location}.\n💬 Inquire via DM (@${author}) for private viewings or holds.`
    },
    {
        id: 'cyberpunk',
        label: 'Retro-Tech Cyber',
        emoji: '💾',
        prompt: 'Retro-Tech Cyberpunk — neon glitch, industrial synth, dystopian artifact, 90s cybercurio.',
        directives: 'Gritty, electric, street-level neon underworld. Tabletop grails, vintage hardware, and dystopian artifacts salvaged from the pre-crash era. Inject textures: brushed aluminum casings, CRT phosphors, faded ribbon cables, and gritty 90s industrial print.',
        hooks: [
            '💾 [SYSTEM ALERT]: Fresh batch of retro-tech artifacts, cyberpunk sourcebooks, and dystopian grails just deployed.',
            '⚡ High tech, low life. Unboxed a rare cache of 90s cybercurios, tabletop grails, and industrial synth aesthetics.',
            '🔌 Booting archive recovery sector 07: vintage electronics, dystopian manuals, and netrunner artifacts live on the floor.',
            '🕹️ Direct hardware interface: rare retro-tech curios and dystopian counterculture grails just stocked.',
            '💾 Analog chips, yellowed industrial plastic, and pre-crash sourcebooks pulled from subterranean storage.'
        ],
        cta: (author, location) => `⚡ Jack in at ${location} before the street sweeps them clean.\n💬 Transmit a DM to @${author} to secure yours.`
    },
    {
        id: 'scandi',
        label: 'Curated Scandi / Curio',
        emoji: '🌿',
        prompt: 'Organic Minimalist — warm neutral curation, artisanal pottery, timeless handcrafted mid-century warmth.',
        directives: 'Warm, observant, soulful archivist celebrating forgotten provenance, tactile craftsmanship, and the stories embedded in aged objects. Inject textures: hand-thrown stoneware glaze, oiled teak grain, honest linen weave, and warm sunlight.',
        hooks: [
            '✨ Freshly curated & tagged: timeless treasures and antique oddities have just landed in our booth.',
            '🕰️ Every object carries the quiet pulse of the hands that held it first. A fresh batch of soulful heirlooms has arrived.',
            '🌿 Hand-turned brass, worn patinas, and forgotten craftsmanship: our latest curation is officially restocked.',
            '🪞 Step into our cabinet of curiosities: storied vintage decor, timeless apparel, and relics waiting for their next chapter.',
            '☕ Warm linen, stoneware with honest throwing ridges, and quiet everyday treasures that bring peace to a space.'
        ],
        cta: (author, location) => `📍 Visit our booth inside ${location}!\n💬 DM @${author} or comment to hold before they find their next home.`
    },
    {
        id: 'hype_drop',
        label: 'Hype Drop & Grails',
        emoji: '🔥',
        prompt: 'Hype Drop — high-energy treasure hunt, PNW thrift grails, streetwear outerwear, rare finds.',
        directives: 'Urgent, electric, underground treasure hunt energy for elusive grails unearthed from Pacific Northwest hauls. Highlight maker pedigrees and condition with urgency.',
        hooks: [
            '🔥 FRESH DROP ON THE FLOOR: Just unboxed the highest-heat haul of the month.',
            '🚨 PACIFIC NORTHWEST HEAT: Unbelievable vintage outerwear, rare tees, and collector grails just hit the rack.',
            '⚡ Don\'t sleep on this drop — holy-grail pieces freshly tagged and stocked in the booth right now.',
            '📦 Fresh unboxing complete: pure 90s gold, heavyweight outerwear, and pristine vintage classics.'
        ],
        cta: (author, location) => `🏃‍♂️ Sprint to ${location} before someone else claims your grail.\n💬 Drop a comment or DM @${author} for quick holds!`
    }
];

export function resolvePersona(toneOrId?: string): SocialPersona {
    const raw = (toneOrId || '').toLowerCase().trim();
    if (!raw) return SOCIAL_PERSONAS[0];

    // Match exact ID
    const byId = SOCIAL_PERSONAS.find(p => p.id === raw);
    if (byId) return byId;

    // Fuzzy match keywords
    if (raw.includes('lestat') || raw.includes('vampire') || raw.includes('goth')) {
        return SOCIAL_PERSONAS[0];
    }
    if (raw.includes('academia') || raw.includes('scholar') || raw.includes('antiquarian')) {
        return SOCIAL_PERSONAS[1];
    }
    if (raw.includes('cyber') || raw.includes('tech') || raw.includes('y2k') || raw.includes('synth')) {
        return SOCIAL_PERSONAS[2];
    }
    if (raw.includes('scandi') || raw.includes('curio') || raw.includes('minimal') || raw.includes('vintage') || raw.includes('heirloom')) {
        return SOCIAL_PERSONAS[3];
    }
    if (raw.includes('hype') || raw.includes('grail') || raw.includes('street')) {
        return SOCIAL_PERSONAS[4];
    }

    return SOCIAL_PERSONAS[0];
}

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Builds the comprehensive Gemini AI prompt for generating social posts.
 */
export function buildSocialPostPrompt(options: SocialPostOptions): string {
    const {
        items,
        locationName,
        authorHandle = 'resalecommand',
        platform = 'instagram',
        tone,
        customTone,
        includePrices = true,
        customNotes,
        hasLocationPhotos,
        hasMeasurements
    } = options;

    const persona = resolvePersona(tone);
    const effectiveDirectives = customTone ? `${persona.directives}\nADDITIONAL CURATOR INSTRUCTION: ${customTone}` : persona.directives;

    const itemsSummary = items.map((it, idx) => {
        const priceStr = it.resalePrice ? ` - $${Number(it.resalePrice).toFixed(2)}` : '';
        const brandStr = it.brand ? ` [Brand: ${it.brand}]` : '';
        const condStr = it.condition ? ` (Condition: ${it.condition})` : '';
        return `${idx + 1}. ${it.title}${priceStr}${brandStr}${condStr}`;
    }).join('\n');

    return `You are a master literary copywriter and atmospheric storyteller for @${authorHandle}, a curated collector, vintage archivist, and antique dealer with an in-person booth inside "${locationName}".
Your mission is to write a deeply evocative, scroll-stopping social media post announcement for a new inventory drop that makes vintage lovers and collectors feel an irresistible urge to visit or claim a piece.

CONTEXT:
- Brand Account: @${authorHandle} (curator posting this)
- Physical Venue: "${locationName}" (the antique mall / collective where the items are displayed)
- CRITICAL VENUE RULE: Do NOT confuse the curator (@${authorHandle}) with the host venue ("${locationName}"). The post is from @${authorHandle} inviting readers to visit their booth at "${locationName}".
- Target Platform: ${platform.toUpperCase()}
- Pricing Display: ${includePrices ? 'YES, include exact prices beside each item title' : 'NO, tell collectors to DM or check in-booth for prices'}
- Curator's Notes: ${customNotes || 'None provided'}
- Location Photos Available: ${hasLocationPhotos ? 'Yes (remind readers to swipe to view shelf/booth location)' : 'No'}
- Measurements Marked: ${hasMeasurements ? 'Yes' : 'No'}

VOICE & PERSONA:
${effectiveDirectives}

ATMOSPHERIC WRITING DIRECTIVES:
- Go DEEP. Avoid surface-level marketing speak, generic enthusiasm, and shallow 1-line bullet points.
- Inject visceral sensory texture and material patina into the writing: mention the tactile weight, crushed velvet nap, oxidized metal, deckled paper edges, hand-carved grain, heirloom aroma, or twilight allure.
- Vary your opening hook! Do NOT use cliché formulas or repeat the exact same Anne Rice quote every time. Craft an original, magnetic opening line born from the specific items in this collection.
- Under nominative fair use, authentically name genuine brands (Levi's, Pendleton, Sony, Carhartt, TSR, etc.) when describing items.
- Never claim official corporate sponsorship or quote full copyrighted books word-for-word.

ITEMS IN THIS DROP (${items.length} total):
${itemsSummary}

POST STRUCTURE FOR ${platform.toUpperCase()}:
1. Dynamic, atmospheric opening hook (evocative, cinematic, or poetic — avoid repetitive cliché openers).
2. Deep narrative scene-setting paragraph connecting the curation to the space inside "${locationName}".
3. Hero Item Highlights: For 4 to 8 featured items, write a rich 1-2 sentence micro-story highlighting its tactile patina, aesthetic significance, and era, followed by ${includePrices ? 'the exact price' : 'a prompt to DM for price'}.
4. Clear in-character Call-to-Action: Direct readers to visit the booth inside "${locationName}" or send a DM to claim a hold before it vanishes.
5. Curated cluster of 15-25 aesthetic, high-traffic hashtags matching the genre and local area (#pdxvintage, #${locationName.toLowerCase().replace(/[^a-z0-9]/g, '')}, #curatedvintage, #antiqueoddities, etc.).

Return ONLY the complete ready-to-publish post text. Do not wrap in markdown code fence blocks.`;
}

/**
 * Generates an atmospheric, dynamic fallback post when AI generation is unavailable.
 * Guarantees varied opening hooks and rich formatting across offline / template mode.
 */
export function generateDynamicFallbackPost(options: SocialPostOptions): string {
    const {
        items,
        locationName,
        authorHandle = 'resalecommand',
        platform = 'instagram',
        tone,
        includePrices = true,
        customNotes,
        hasLocationPhotos,
        hasMeasurements
    } = options;

    const persona = resolvePersona(tone);
    const selectedHook = pickRandom(persona.hooks);
    let cta = persona.cta(authorHandle, locationName);

    const itemBullets = items.slice(0, 10).map((it) => {
        const priceStr = includePrices && it.resalePrice ? ` — $${Number(it.resalePrice).toFixed(2)}` : '';
        const brandStr = it.brand ? ` [${it.brand}]` : '';
        return `• ${it.title}${brandStr}${priceStr}`;
    }).join('\n');

    const moreText = items.length > 10 ? `\n...plus ${items.length - 10} more pieces waiting in the booth!\n` : '';

    if (hasLocationPhotos) {
        cta += `\n📸 Swipe to the end of the reel to see our exact booth shelf location & display!`;
    }
    if (hasMeasurements) {
        cta += `\n📏 Exact dimensions and measurements are marked directly on the photos!`;
    }

    if (platform === 'story') {
        cta = `📍 In stock today at ${locationName}! Swipe up or DM @${authorHandle} for holds.`;
        if (hasLocationPhotos) cta += ` Booth photo on last slide!`;
    }

    const hashtagString = generateDynamicHashtags(items, locationName, persona.id);
    const noteSection = customNotes ? `\n\n📌 Curator Note: ${customNotes}` : '';

    return `${selectedHook}\n\n${itemBullets}${moreText}${noteSection}\n\n${cta}\n\n.\n.\n.\n${hashtagString}`;
}

/**
 * Builds a curated cluster of high-traffic hashtags tailored to items and genre.
 */
export function generateDynamicHashtags(items: SocialPostItemInput[], locationName: string, personaId?: string): string {
    const baseTags = ['#resale', '#vintage', '#curatedvintage', '#thrifthaul', '#shoplocal', '#vintagedrop', '#fleamarketfinds'];
    const locTag = locationName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (locTag) baseTags.unshift(`#${locTag}`);
    baseTags.push('#portlandvintage', '#pdxvintage', '#antiquemall');

    const allTitles = items.map(i => i.title.toLowerCase()).join(' ');

    if (allTitles.includes('cyberpunk') || allTitles.includes('rpg') || allTitles.includes('d&d') || personaId === 'cyberpunk') {
        baseTags.push('#ttrpg', '#cyberpunk', '#tabletoprpg', '#vintagerpg', '#retrogaming');
    }
    if (allTitles.includes('goth') || allTitles.includes('skull') || allTitles.includes('rose') || allTitles.includes('velvet') || personaId === 'lestat') {
        baseTags.push('#whimsigoth', '#gothdecor', '#darkaesthetic', '#gothichome', '#vampireaesthetic');
    }
    if (allTitles.includes('book') || allTitles.includes('novel') || personaId === 'academia') {
        baseTags.push('#vintagebooks', '#bookstagram', '#rarebooks', '#darkacademia', '#antiquarian');
    }
    if (allTitles.includes('jacket') || allTitles.includes('shirt') || allTitles.includes('dress') || allTitles.includes('hat') || allTitles.includes('denim')) {
        baseTags.push('#vintageclothing', '#vintagestyle', '#ootd', '#vintagefashion');
    }

    return Array.from(new Set(baseTags)).join(' ');
}
