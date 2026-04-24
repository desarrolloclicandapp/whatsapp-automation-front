// Plan catalog shared across billing screens.
// Ordered by price for upgrade/downgrade comparisons.

// 1) Standard plans (new users / < 10 subaccounts)
export const PLANS_STANDARD = [
    {
        id: 'price_1SmumgHSoN0LpQiB9BrDVtoV',
        nameKey: 'sub.plan.starter',
        priceValue: 29,
        price: '29$',
        annualId: 'price_1SmuvRHSoN0LpQiB3MXFsBqV',
        annualPrice: '290$',
        limits: { subs: 1, slots: 5 },
        featureKeys: ['sub.feat.1_sub', 'sub.feat.5_numbers_std', 'sub.feat.save_annual'],
        color: 'bg-blue-600',
        badgeKey: 'sub.badge.start'
    },
    {
        id: 'price_1TFF6kHSoN0LpQiB3VTKviL5',
        nameKey: 'sub.plan.growth',
        priceValue: 67,
        price: '67$',
        annualId: 'price_1TFF7NHSoN0LpQiBkPrf7uNh',
        annualPrice: '670$',
        limits: { subs: 3, slots: 15 },
        featureKeys: ['sub.feat.3_subs', 'sub.feat.15_numbers_std', 'sub.feat.save_annual'],
        color: 'bg-indigo-600',
        recommended: true,
        badgeKey: 'sub.badge.popular'
    },
    {
        id: 'price_1TFF22HSoN0LpQiBl3VGFxpa',
        nameKey: 'sub.plan.agency',
        priceValue: 189,
        price: '189$',
        annualId: 'price_1TFF43HSoN0LpQiBYZk80pce',
        annualPrice: '1890$',
        limits: { subs: 10, slots: 50 },
        featureKeys: ['sub.feat.10_subs', 'sub.feat.50_numbers_std', 'sub.feat.save_annual'],
        color: 'bg-purple-600',
        badgeKey: 'sub.badge.agency'
    }
];

// 2) Founder plans (users with founder lifetime pass)
export const PLANS_FOUNDER = [
    {
        id: 'price_1SmxK5HSoN0LpQiB4051Ko2I',
        nameKey: 'sub.plan.starter_addon',
        priceValue: 15,
        price: '15$',
        annualId: null,
        annualPrice: '150$',
        limits: { subs: 1, slots: 5 },
        featureKeys: ['sub.feat.1_extra_sub', 'sub.feat.5_numbers', 'sub.feat.reduced_price'],
        color: 'bg-emerald-600',
        badgeKey: 'sub.badge.founder_benefit'
    },
    {
        id: 'price_1Smxb3HSoN0LpQiBBaaGKcOo',
        nameKey: 'sub.plan.growth_addon',
        priceValue: 49,
        price: '49$',
        annualId: 'price_1Smv4cHSoN0LpQiBe5sq49mt',
        annualPrice: '490$',
        limits: { subs: 3, slots: 15 },
        featureKeys: ['sub.feat.3_extra_subs', 'sub.feat.15_numbers', 'sub.feat.save_annual'],
        color: 'bg-indigo-600'
    },
    {
        id: 'price_1SmxcGHSoN0LpQiB2boUJAkF',
        nameKey: 'sub.plan.agency_addon',
        priceValue: 149,
        price: '149$',
        annualId: 'price_1SmusiHSoN0LpQiBBaC65w6e',
        annualPrice: '1490$',
        limits: { subs: 10, slots: 50 },
        featureKeys: ['sub.feat.10_extra_subs', 'sub.feat.50_numbers', 'sub.feat.save_annual'],
        color: 'bg-purple-600'
    }
];

// 3) Volume plans (standard users with >= 10 subaccounts)
export const PLANS_VOLUME = [
    {
        id: 'price_1Smv3OHSoN0LpQiBZnKxPhQ3',
        nameKey: 'sub.plan.starter_volume',
        priceValue: 15,
        price: '15$',
        annualId: null,
        annualPrice: '150$',
        limits: { subs: 1, slots: 99 },
        featureKeys: ['sub.feat.1_extra_sub', 'sub.feat.infinite_numbers', 'sub.feat.volume_price'],
        color: 'bg-orange-600',
        badgeKey: 'sub.badge.volume'
    }
];

// Founder lifetime plan
export const PLAN_LIFETIME = {
    id: 'price_1SmuqPHSoN0LpQiBoPVJaaRY',
    nameKey: 'sub.plan.founders_pass',
    priceValue: 997,
    price: '997$',
    limits: { subs: 10, slots: 50 },
    featureKeys: ['sub.feat.one_time', 'sub.feat.10_subs', 'sub.feat.50_initial', 'sub.feat.special_addons'],
    color: 'bg-black border-2 border-yellow-400',
    isOneTime: true,
    badgeKey: 'sub.badge.limited'
};

// Add-on pricing IDs
export const ADDONS = {
    // Subagency (+5 slots)
    SUB_UNIT_STD: 'price_1SfK2d7Mhd9qo6A8AI3ZkOQT',
    SUB_UNIT_VIP: 'price_1SfK547Mhd9qo6A8SfvT8GF4',
    // Individual slot
    SLOT_UNIT_STD: 'price_1SfK787Mhd9qo6A8WmPRs9Zy',
    SLOT_UNIT_VIP: 'price_1SfK827Mhd9qo6A89iZ68SRi'
};

// Labels used in subscription list fallback mapping
export const PLAN_DETAILS = {
    // Temp/new IDs
    'price_STARTER_29_TEMP': { label: 'Starter: 1 Sub / 5 Num' },
    'price_GROWTH_49_TEMP': { label: 'Growth: 3 Sub / 15 Num' },
    'price_AGENCY_149_TEMP': { label: 'Agency: 10 Sub / 50 Num' },
    'price_ONETIME_950_TEMP': { label: 'LIFETIME: 10 Sub / 50 Num' },
    'price_DISC_REGULAR_15_TEMP': { label: 'Regular Addon' },
    'price_DISC_PRO_35_TEMP': { label: 'Pro Addon' },
    'price_DISC_ENTERPRISE_125_TEMP': { label: 'Enterprise Addon' },

    // Active add-on IDs
    'price_1SfK2d7Mhd9qo6A8AI3ZkOQT': { label: 'Subagency Addon (Std)' },
    'price_1SfK547Mhd9qo6A8SfvT8GF4': { label: 'Subagency Addon (VIP)' },
    'price_1SfK787Mhd9qo6A8WmPRs9Zy': { label: 'Slot Addon (Std)' },
    'price_1SfK827Mhd9qo6A89iZ68SRi': { label: 'Slot Addon (VIP)' },

    // Legacy IDs (backward compatibility)
    'price_1SfJpk7Mhd9qo6A8AmFiKTdk': { label: 'Legacy Regular' },
    'price_1SfJqb7Mhd9qo6A8zP0xydlX': { label: 'Legacy Pro' },
    'price_1SfJrZ7Mhd9qo6A8WOn6BGbJ': { label: 'Legacy Enterprise' }
};

// 4) Standalone plans (Go / Flow / Elite)
export const STANDALONE_PLANS_STANDARD = [
    {
        id: 'price_1TOii0HSoN0LpQiBieTZRrUU',
        nameKey: 'standalone.subscription.plan_go',
        priceValue: 29,
        price: '29$',
        annualId: 'price_1TOii0HSoN0LpQiBz9r0nqBz',
        annualPrice: '290$',
        limits: { slots: 1 },
        featureKeys: [
            'standalone.subscription.feat.go_1',
            'standalone.subscription.feat.go_2',
            'standalone.subscription.feat.go_3',
            'standalone.subscription.feat.go_4',
            'standalone.subscription.feat.go_5',
            'standalone.subscription.feat.go_6',
            'standalone.subscription.feat.go_7',
            'standalone.subscription.feat.go_8'
        ],
        color: 'bg-blue-600'
    },
    {
        id: 'price_1TOimyHSoN0LpQiB6u9YT6lk',
        nameKey: 'standalone.subscription.plan_flow',
        priceValue: 97,
        price: '97$',
        annualId: 'price_1TOimyHSoN0LpQiB0pupYGHU',
        annualPrice: '970$',
        limits: { slots: 3 },
        featureKeys: [
            'standalone.subscription.feat.flow_1',
            'standalone.subscription.feat.flow_2',
            'standalone.subscription.feat.flow_3',
            'standalone.subscription.feat.flow_4',
            'standalone.subscription.feat.flow_5',
            'standalone.subscription.feat.flow_6',
            'standalone.subscription.feat.flow_7',
            'standalone.subscription.feat.flow_8',
            'standalone.subscription.feat.flow_9',
            'standalone.subscription.feat.flow_10',
            'standalone.subscription.feat.flow_11',
            'standalone.subscription.feat.flow_12'
        ],
        color: 'bg-indigo-600',
        recommended: true
    },
    {
        id: 'price_1TOithHSoN0LpQiBwp9tadRl',
        nameKey: 'standalone.subscription.plan_elite',
        priceValue: 247,
        price: '247$',
        annualId: 'price_1TOithHSoN0LpQiBENAvlxHF',
        annualPrice: '2470$',
        limits: { slots: 10 },
        featureKeys: [
            'standalone.subscription.feat.elite_1',
            'standalone.subscription.feat.elite_2',
            'standalone.subscription.feat.elite_3',
            'standalone.subscription.feat.elite_4',
            'standalone.subscription.feat.elite_5',
            'standalone.subscription.feat.elite_6',
            'standalone.subscription.feat.elite_7',
            'standalone.subscription.feat.elite_8',
            'standalone.subscription.feat.elite_9',
            'standalone.subscription.feat.elite_10',
            'standalone.subscription.feat.elite_11'
        ],
        color: 'bg-purple-600'
    }
];

export const STANDALONE_PRICE_TO_PLAN = {
    price_1TOii0HSoN0LpQiBieTZRrUU: 'price_1TOii0HSoN0LpQiBieTZRrUU',
    price_1TOii0HSoN0LpQiBz9r0nqBz: 'price_1TOii0HSoN0LpQiBieTZRrUU',
    price_1TOimyHSoN0LpQiB6u9YT6lk: 'price_1TOimyHSoN0LpQiB6u9YT6lk',
    price_1TOimyHSoN0LpQiB0pupYGHU: 'price_1TOimyHSoN0LpQiB6u9YT6lk',
    price_1TOithHSoN0LpQiBwp9tadRl: 'price_1TOithHSoN0LpQiBwp9tadRl',
    price_1TOithHSoN0LpQiBENAvlxHF: 'price_1TOithHSoN0LpQiBwp9tadRl'
};

export const STANDALONE_PLAN_DETAILS = {
    price_1TOii0HSoN0LpQiBieTZRrUU: { label: 'Go' },
    price_1TOii0HSoN0LpQiBz9r0nqBz: { label: 'Go (Anual)' },
    price_1TOimyHSoN0LpQiB6u9YT6lk: { label: 'Flow' },
    price_1TOimyHSoN0LpQiB0pupYGHU: { label: 'Flow (Anual)' },
    price_1TOithHSoN0LpQiBwp9tadRl: { label: 'Elite' },
    price_1TOithHSoN0LpQiBENAvlxHF: { label: 'Elite (Anual)' }
};
