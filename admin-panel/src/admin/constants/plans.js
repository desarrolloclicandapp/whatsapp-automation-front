
// --- CONFIGURACIÓN DE PLANES BASE ---
// Ordenados por precio para calcular upgrades/downgrades
// --- CONFIGURACIÓN DE PLANES ---
// Definimos los grupos de planes para usarlos según el estado del usuario

// 1. PLANES ESTÁNDAR (Usuarios Nuevos / <10 Subs)
export const PLANS_STANDARD = [
    {
        id: 'price_1SmumgHSoN0LpQiB9BrDVtoV',
        nameKey: 'sub.plan.starter',
        priceValue: 29,
        price: '29$',
        annualId: 'price_1SmuvRHSoN0LpQiB3MXFsBqV',
        annualPrice: '290$',
        limits: { subs: 1 },
        featureKeys: ['sub.feat.1_sub', 'sub.feat.99_numbers', 'sub.feat.save_annual'],
        color: 'bg-blue-600',
        badgeKey: 'sub.badge.start'
    },
    {
        id: 'price_1Smuo8HSoN0LpQiB5z8FHJwp',
        nameKey: 'sub.plan.growth',
        priceValue: 49,
        price: '49$',
        annualId: 'price_1Smv4cHSoN0LpQiBe5sq49mt',
        annualPrice: '490$',
        limits: { subs: 3 },
        featureKeys: ['sub.feat.3_subs', 'sub.feat.99_numbers', 'sub.feat.save_annual'],
        color: 'bg-indigo-600',
        recommended: true,
        badgeKey: 'sub.badge.popular'
    },
    {
        id: 'price_1Smup2HSoN0LpQiBOCHw8R0Y',
        nameKey: 'sub.plan.agency',
        priceValue: 149,
        price: '149$',
        annualId: 'price_1SmusiHSoN0LpQiBBaC65w6e',
        annualPrice: '1490$',
        limits: { subs: 10 },
        featureKeys: ['sub.feat.10_subs', 'sub.feat.99_numbers', 'sub.feat.save_annual'],
        color: 'bg-purple-600',
        badgeKey: 'sub.badge.agency'
    }
];

// 2. PLANES FOUNDER (Usuarios que compraron el pase de $950)
// Tienen reglas de slot especiales acumulativas
export const PLANS_FOUNDER = [
    {
        id: 'price_1SmxK5HSoN0LpQiB4051Ko2I', // Precio Reducido
        nameKey: 'sub.plan.starter_addon',
        priceValue: 15,
        price: '15$',
        annualId: null, // No provisto aún, solo mensual
        annualPrice: '150$',
        limits: { subs: 1 },
        featureKeys: ['sub.feat.1_extra_sub', 'sub.feat.5_numbers', 'sub.feat.reduced_price'],
        color: 'bg-emerald-600',
        badgeKey: 'sub.badge.founder_benefit'
    },
    {
        id: 'price_1Smxb3HSoN0LpQiBBaaGKcOo', // Precio NO Reducido (Standard)
        nameKey: 'sub.plan.growth_addon',
        priceValue: 49,
        price: '49$',
        annualId: 'price_1Smv4cHSoN0LpQiBe5sq49mt',
        annualPrice: '490$',
        limits: { subs: 3 },
        featureKeys: ['sub.feat.3_extra_subs', 'sub.feat.15_numbers', 'sub.feat.save_annual'],
        color: 'bg-indigo-600',
    },
    {
        id: 'price_1SmxcGHSoN0LpQiB2boUJAkF', // Precio NO Reducido (Standard)
        nameKey: 'sub.plan.agency_addon',
        priceValue: 149,
        price: '149$',
        annualId: 'price_1SmusiHSoN0LpQiBBaC65w6e',
        annualPrice: '1490$',
        limits: { subs: 10 },
        featureKeys: ['sub.feat.10_extra_subs', 'sub.feat.50_numbers', 'sub.feat.save_annual'],
        color: 'bg-purple-600',
    }
];

// 3. PLANES VOLUMEN (Usuarios Standard con >= 10 Subs)
// Solo el Starter reducido, según requerimiento.
export const PLANS_VOLUME = [
    {
        id: 'price_1Smv3OHSoN0LpQiBZnKxPhQ3',
        nameKey: 'sub.plan.starter_volume',
        priceValue: 15,
        price: '15$',
        annualId: null, // No provisto aún
        annualPrice: '150$',
        limits: { subs: 1 },
        featureKeys: ['sub.feat.1_extra_sub', 'sub.feat.infinite_numbers', 'sub.feat.volume_price'],
        color: 'bg-orange-600',
        badgeKey: 'sub.badge.volume'
    }
    // Podríamos añadir los otros a precio full si el cliente quiere crecer rápido
];

// PLAN FOUNDER LIFETIME
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

// --- ADD-ONS ---
export const ADDONS = {
    // Definir si usaremos addons específicos o reutilizamos planes
    // Por ahora dejamos placeholder
    SUB_UNIT_STD: 'price_STARTER_29_TEMP',
    SUB_UNIT_VIP: 'price_DISC_REGULAR_15_TEMP',
    SLOT_UNIT_STD: 'price_1SfK787Mhd9qo6A8WmPRs9Zy',
    SLOT_UNIT_VIP: 'price_1SfK827Mhd9qo6A89iZ68SRi'
};

// --- MAPEO DE DETALLES ---
export const PLAN_DETAILS = {
    // New IDs
    'price_STARTER_29_TEMP': { label: 'Starter: 1 Sub / 99 Num' },
    'price_GROWTH_49_TEMP': { label: 'Growth: 3 Sub / 99 Num' },
    'price_AGENCY_149_TEMP': { label: 'Agency: 10 Sub / 99 Num' },

    'price_ONETIME_950_TEMP': { label: 'LIFETIME: 10 Sub / 50 Num' },

    'price_DISC_REGULAR_15_TEMP': { label: 'Regular Addon' },
    'price_DISC_PRO_35_TEMP': { label: 'Pro Addon' },
    'price_DISC_ENTERPRISE_125_TEMP': { label: 'Enterprise Addon' },

    // Old IDs (Backwards compat)
    'price_1SfJpk7Mhd9qo6A8AmFiKTdk': { label: 'Legacy Regular' },
    'price_1SfJqb7Mhd9qo6A8zP0xydlX': { label: 'Legacy Pro' },
    'price_1SfJrZ7Mhd9qo6A8WOn6BGbJ': { label: 'Legacy Enterprise' },
};
