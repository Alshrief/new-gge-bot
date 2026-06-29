import * as React from 'react'
import { Paper, Typography, Grid, Box, Tooltip } from '@mui/material'
import { 
  TrendingUp, TreePine, Blocks, Wheat, Hexagon, 
  GlassWater, Beef, FlameKindling, Droplet, Sparkles, 
  Hammer, AlertTriangle, CheckCircle 
} from 'lucide-react'

let assetsCache = null

const KINGDOM_NAMES = {
  0: { en: "Great Empire", ar: "المملكة العظيمة" },
  1: { en: "Burning Sands", ar: "مملكة الرمال" },
  2: { en: "Everwinter Glacier", ar: "مملكة الجليد" },
  3: { en: "Fire Peaks", ar: "مملكة القمم النارية" },
  4: { en: "Storm Islands", ar: "مملكة العواصف" }
}

const getKingdomTitle = (kingdomID, type, outpostIndex, languageCode) => {
  const isAr = languageCode === 'ar';
  if (kingdomID === 0) {
    if (type === 3) {
      const names = isAr 
        ? ["القاعدة الأولى", "القاعدة الثانية", "القاعدة الثالثة"]
        : ["First Outpost", "Second Outpost", "Third Outpost"];
      return names[outpostIndex] || (isAr ? "قاعدة فرعية" : "Outpost");
    }
    return isAr ? "المملكة العظيمة" : "Great Empire";
  }
  return KINGDOM_NAMES[kingdomID]?.[isAr ? 'ar' : 'en'] || (isAr ? "مملكة أخرى" : "Kingdom");
}

const RESOURCE_DEFS = {
  food: {
    key: "food",
    nameEn: "Food",
    nameAr: "الطعام",
    iconPath: "/icons/Food.webp",
    fallbackIcon: Wheat,
    color: "#eab308", // gold
    isVital: true
  },
  mead: {
    key: "mead",
    nameEn: "Mead",
    nameAr: "الشراب",
    iconPath: "/icons/Mead.webp",
    fallbackIcon: GlassWater,
    color: "#f97316", // orange
    isVital: true
  },
  beef: {
    key: "beef",
    nameEn: "Beef",
    nameAr: "اللحم",
    iconPath: "/icons/Beef.webp",
    fallbackIcon: Beef,
    color: "#ef4444", // red
    isVital: true
  },
  wood: {
    key: "wood",
    nameEn: "Wood",
    nameAr: "الخشب",
    iconPath: "/icons/Wood.webp",
    fallbackIcon: TreePine,
    color: "#854d0e", // brown
    isVital: false
  },
  stone: {
    key: "stone",
    nameEn: "Stone",
    nameAr: "الحجر",
    iconPath: "/icons/Stone.webp",
    fallbackIcon: Blocks,
    color: "#64748b", // slate
    isVital: false
  },
  honey: {
    key: "honey",
    nameEn: "Honey",
    nameAr: "العسل",
    iconPath: "/icons/Honey.webp",
    fallbackIcon: Hexagon,
    color: "#f59e0b", // amber
    isVital: false
  },
  coal: {
    key: "coal",
    nameEn: "Charcoal",
    nameAr: "الفحم",
    iconPath: "/icons/Charcoal.webp",
    fallbackIcon: FlameKindling,
    color: "#475569", // dark slate
    isVital: false
  },
  oil: {
    key: "oil",
    nameEn: "Oil",
    nameAr: "الزيت",
    iconPath: "/icons/OliveOil.webp",
    fallbackIcon: Droplet,
    color: "#0f766e", // teal
    isVital: false
  },
  glass: {
    key: "glass",
    nameEn: "Glass",
    nameAr: "الزجاج",
    iconPath: "/icons/Glass.webp",
    fallbackIcon: Sparkles,
    color: "#38bdf8", // sky blue
    isVital: false
  },
  iron: {
    key: "iron",
    nameEn: "Iron",
    nameAr: "الحديد",
    iconPath: "/icons/Iron_Ore.webp",
    fallbackIcon: Hammer,
    color: "#64748b", // iron gray
    isVital: false
  }
}

const formatNumber = (num, languageCode) => {
  if (num === null || num === undefined || isNaN(num)) return '0'
  return new Intl.NumberFormat(languageCode).format(Math.floor(num))
}

const formatTimeRemaining = (timeInHours, isAr) => {
  if (timeInHours <= 0 || isNaN(timeInHours) || !isFinite(timeInHours)) {
    return isAr ? "فوري" : "Immediately";
  }
  const totalMinutes = Math.round(timeInHours * 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (isAr) {
    if (days > 0) parts.push(`${days} يوم`);
    if (hours > 0) parts.push(`${hours} ساعة`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes} دقيقة`);
    return parts.join(" و ");
  } else {
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
    return parts.join(" ");
  }
}

export default function ProductionOverview({ __, openProduction: rawProduction, languageCode }) {
  const [assets, setAssets] = React.useState(assetsCache || {})
  const isAr = languageCode === 'ar'

  React.useEffect(() => {
    if (!assetsCache) {
      fetch('/assets.json')
        .then(res => res.json())
        .then(json => {
          assetsCache = json
          setAssets(json)
        })
        .catch(err => console.error("Failed to fetch assets.json in ProductionOverview:", err))
    }
  }, [])

  if (!rawProduction || !Array.isArray(rawProduction) || rawProduction.length === 0) {
    return <></>
  }

  // Sort castles
  const KINGDOM_ORDER = { 0: 1, 2: 2, 1: 3, 3: 4, 4: 5 }
  const sortedCastles = [...rawProduction].sort((a, b) => {
    const orderA = KINGDOM_ORDER[a.kingdomID] || 99
    const orderB = KINGDOM_ORDER[b.kingdomID] || 99
    if (orderA !== orderB) return orderA - orderB
    if (a.type !== b.type) return a.type - b.type
    return a.id - b.id
  })

  let outpostCount = 0

  return (
    <div 
      onClick={e => e.stopPropagation()} 
      style={{ 
        width: '100%', 
        maxWidth: '900px', 
        padding: '16px', 
        boxSizing: 'border-box' 
      }}
    >
      <Paper sx={{ 
        maxHeight: '85vh', 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'auto', 
        width: '100%', 
        p: { xs: 2, sm: 3.5 },
        background: 'rgba(15, 23, 42, 0.9)',
        backdropFilter: 'blur(24px)',
        border: '1px solid var(--border-light)',
        borderRadius: '20px',
        boxShadow: '0 24px 50px -12px rgba(0, 0, 0, 0.6)'
      }}>
        <Typography 
          variant="h6" 
          sx={{ 
            mb: 3, 
            fontSize: '1.3rem', 
            fontWeight: 800, 
            fontFamily: "'Cairo', 'Outfit', sans-serif", 
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5
          }}
        >
          <TrendingUp size={24} style={{ color: 'var(--brand)' }} />
          {__("production") || (isAr ? "الموارد والإنتاج" : "Production & Rates")}
        </Typography>

        <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
          {sortedCastles.map((castle, idx) => {
            let index = 0
            if (castle.kingdomID === 0 && castle.type === 3) {
              index = outpostCount
              outpostCount++
            }

            const title = getKingdomTitle(castle.kingdomID, castle.type, index, languageCode)
            const coordsStr = castle.X !== null && castle.Y !== null ? ` (${castle.X}:${castle.Y})` : ''

            return (
              <Box 
                key={castle.id || idx}
                sx={{ 
                  mb: 4, 
                  pb: 3.5, 
                  borderBottom: '1px solid var(--border-light)',
                  '&:last-child': { borderBottom: 'none', mb: 0, pb: 0 }
                }}
              >
                {/* Castle Title */}
                <Typography 
                  variant="subtitle1" 
                  sx={{ 
                    fontSize: '1.05rem', 
                    fontWeight: 800, 
                    color: 'var(--text-primary)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    mb: 2.5
                  }}
                >
                  <span style={{ 
                    width: '8px', 
                    height: '8px', 
                    borderRadius: '50%', 
                    backgroundColor: castle.kingdomID === 0 ? 'var(--brand)' : '#38bdf8' 
                  }} />
                  {castle.name || title}{coordsStr}
                </Typography>

                {/* Vital Resources Grid (Food, Mead, Beef) */}
                <Grid container spacing={2.5} sx={{ mb: 3 }}>
                  {Object.values(RESOURCE_DEFS)
                    .filter(def => def.isVital)
                    .map(def => {
                      const stock = castle.resources?.[def.key] ?? 0
                      const prodRate = castle.production?.[def.key] ?? 0
                      const consRate = castle.production?.[`${def.key}Consumption`] ?? 0
                      const balance = prodRate - consRate
                      const isDeficit = balance < 0
                      const depletionHours = isDeficit ? (stock / Math.abs(balance)) : 0

                      const fallbackIcon = def.fallbackIcon
                      const FallbackComponent = fallbackIcon

                      return (
                        <Grid item xs={12} sm={4} key={def.key}>
                          <Box sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            p: 2,
                            borderRadius: '16px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid var(--border-light)',
                            position: 'relative',
                            overflow: 'hidden'
                          }}>
                            {/* Card Accent line */}
                            <div style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              height: '3px',
                              backgroundColor: def.color
                            }} />

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                              <div style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img 
                                  alt={isAr ? def.nameAr : def.nameEn} 
                                  style={{ maxHeight: '100%', maxWidth: '100%' }}
                                  src={def.iconPath}
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallbackEl = e.currentTarget.nextSibling;
                                    if (fallbackEl) fallbackEl.style.display = 'flex';
                                  }}
                                />
                                <div style={{ display: 'none', color: def.color }}>
                                  <FallbackComponent size={24} />
                                </div>
                              </div>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                                {isAr ? def.nameAr : def.nameEn}
                              </Typography>
                            </Box>

                            {/* Stockpile */}
                            <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-primary)', mb: 1.5 }}>
                              {formatNumber(stock, languageCode)}
                            </Typography>

                            {/* Rates details */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: '0.85rem' }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                                <span>{isAr ? 'الإنتاج بالساعة:' : 'Production/h:'}</span>
                                <span style={{ color: '#10b981', fontWeight: 600 }}>+{formatNumber(prodRate, languageCode)}</span>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                                <span>{isAr ? 'الاستهلاك بالساعة:' : 'Consumption/h:'}</span>
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>-{formatNumber(consRate, languageCode)}</span>
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255, 255, 255, 0.05)', pt: 0.5, mt: 0.5, fontWeight: 700 }}>
                                <span>{isAr ? 'الصافي:' : 'Net:'}</span>
                                <span style={{ color: isDeficit ? '#ef4444' : '#10b981' }}>
                                  {isDeficit ? '' : '+'}{formatNumber(balance, languageCode)}
                                </span>
                              </Box>
                            </Box>

                            {/* Depletion Time Widget */}
                            {isDeficit ? (
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 1, 
                                mt: 2, 
                                p: 1, 
                                borderRadius: '8px', 
                                bgcolor: 'rgba(239, 68, 68, 0.1)', 
                                border: '1px solid rgba(239, 68, 68, 0.2)' 
                              }}>
                                <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                                <Typography variant="caption" sx={{ color: '#ef4444', fontWeight: 700, lineHeight: 1.2 }}>
                                  {isAr ? 'ينفد المخزون خلال:' : 'Runs out in:'} <br />
                                  <span style={{ fontSize: '0.8rem' }}>{formatTimeRemaining(depletionHours, isAr)}</span>
                                </Typography>
                              </Box>
                            ) : (
                              <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 1, 
                                mt: 2, 
                                p: 1, 
                                borderRadius: '8px', 
                                bgcolor: 'rgba(16, 185, 129, 0.1)', 
                                border: '1px solid rgba(16, 185, 129, 0.2)' 
                              }}>
                                <CheckCircle size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                                <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 700, lineHeight: 1.2 }}>
                                  {isAr ? 'الإنتاج مستقر وآمن' : 'Production is stable'}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        </Grid>
                      )
                    })}
                </Grid>

                {/* Common Resources Grid */}
                <Typography variant="body2" sx={{ fontWeight: 800, color: 'var(--text-muted)', mb: 1.5, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  {isAr ? 'الموارد الأخرى' : 'Other Resources'}
                </Typography>
                <Grid container spacing={1.5}>
                  {Object.values(RESOURCE_DEFS)
                    .filter(def => !def.isVital)
                    .map(def => {
                      const stock = castle.resources?.[def.key] ?? 0
                      const prodRate = castle.production?.[def.key] ?? 0
                      const fallbackIcon = def.fallbackIcon
                      const FallbackComponent = fallbackIcon

                      return (
                        <Grid item xs={6} sm={4} md={2.4} key={def.key}>
                          <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            p: 1.2,
                            borderRadius: '12px',
                            background: 'rgba(255, 255, 255, 0.01)',
                            border: '1px solid var(--border-light)'
                          }}>
                            <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <img 
                                alt={isAr ? def.nameAr : def.nameEn} 
                                style={{ maxHeight: '100%', maxWidth: '100%' }}
                                src={def.iconPath}
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallbackEl = e.currentTarget.nextSibling;
                                  if (fallbackEl) fallbackEl.style.display = 'flex';
                                }}
                              />
                              <div style={{ display: 'none', color: def.color }}>
                                <FallbackComponent size={18} />
                              </div>
                            </div>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {isAr ? def.nameAr : def.nameEn}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: 'var(--text-primary)', mt: 0.1, fontSize: '0.8rem' }}>
                                {formatNumber(stock, languageCode)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#10b981', display: 'block', fontWeight: 700, fontSize: '0.7rem' }}>
                                +{formatNumber(prodRate, languageCode)}/h
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                      )
                    })}
                </Grid>

              </Box>
            )
          })}
        </Box>
      </Paper>
    </div>
  )
}
