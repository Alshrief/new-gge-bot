import * as React from 'react'
import { Paper, Typography, Grid, Box, Button, IconButton } from '@mui/material'
import { ChevronLeft, ChevronRight, Swords, Shield, Hammer, Sparkles, AlertCircle } from 'lucide-react'

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

const classifyUnit = (unit) => {
  if (unit.name === "Eventtool" || unit.toolCategory === "Event" || (unit.toolCategory && unit.toolCategory.toLowerCase() === "event")) {
    return "event";
  }
  if (unit.typ === "Attack") {
    return "siege";
  }
  if (unit.typ === "Defence" || unit.typ === "Defense") {
    return "defense";
  }
  return "troops";
}

function CastleRow({ castle, outpostIndex, __, languageCode, assets }) {
  const [activeFilter, setActiveFilter] = React.useState('all')
  const scrollRef = React.useRef(null)

  const isRtl = languageCode === 'ar'
  const title = getKingdomTitle(castle.kingdomID, castle.type, outpostIndex, languageCode)
  const coordsStr = castle.X !== null && castle.Y !== null ? ` (${castle.X}:${castle.Y})` : ''

  const units = castle.units || []
  
  // Filter units
  const filteredUnits = units.filter(u => {
    if (activeFilter === 'all') return true
    return classifyUnit(u) === activeFilter
  })

  // Group size check for scroll showing
  const showScrollArrows = filteredUnits.length > 4

  const handleScroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = 300
      // In RTL, scroll direction needs to be inverted for correct scrolling
      const multiplier = isRtl ? -1 : 1
      const offset = direction === 'left' ? -scrollAmount : scrollAmount
      scrollRef.current.scrollBy({
        left: offset * multiplier,
        behavior: 'smooth'
      })
    }
  }

  const filters = [
    { key: 'all', label: __('all') || (isRtl ? 'الكل' : 'All'), icon: null },
    { key: 'troops', label: __('troops') || (isRtl ? 'الجنود' : 'Troops'), icon: <Swords size={14} /> },
    { key: 'siege', label: __('siegeTools') || (isRtl ? 'أدوات الحصار' : 'Siege Tools'), icon: <Hammer size={14} /> },
    { key: 'defense', label: __('defenseTools') || (isRtl ? 'أدوات الدفاع' : 'Defense Tools'), icon: <Shield size={14} /> },
    { key: 'event', label: __('eventTools') || (isRtl ? 'أدوات الأحداث' : 'Event Tools'), icon: <Sparkles size={14} /> }
  ]

  const getUnitName = (u) => {
    const type = u.type || ''
    const comment2 = u.comment2 || ''
    
    // Attempt standard game language keys
    let label = __(`${type}_name`)
    if (label === `${type}_name` && type) {
      label = __(`${type.toLowerCase()}_name`)
    }
    if (label === `${type.toLowerCase()}_name` && comment2) {
      label = __(`${comment2}_name`)
    }
    if (label === `${comment2}_name` && comment2) {
      label = __(`${comment2.toLowerCase()}_name`)
    }
    
    // Fallbacks
    if (label.includes('_name')) {
      label = comment2 || type || u.name || `WOD: ${u.wodID}`
    }
    return label
  }

  const getUnitAsset = (u) => {
    const assetKey1 = `${u.name}_Unit_${u.type}`
    const assetKey2 = `${u.name}_Unit_${u.comment2}`
    const path = assets[assetKey1] || assets[assetKey2] || assets[u.name]
    return path ? `/ggeProxyEmpire5/default/assets/${path}.webp` : null
  }

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'troops': return '#ef4444' // red
      case 'siege': return '#fbbf24' // gold
      case 'defense': return '#3b82f6' // blue
      case 'event': return '#a78bfa' // purple
      default: return 'var(--text-muted)'
    }
  }

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'troops': return <Swords size={20} style={{ color: '#ef4444' }} />
      case 'siege': return <Hammer size={20} style={{ color: '#fbbf24' }} />
      case 'defense': return <Shield size={20} style={{ color: '#3b82f6' }} />
      case 'event': return <Sparkles size={20} style={{ color: '#a78bfa' }} />
      default: return null
    }
  }

  return (
    <Box sx={{ 
      mb: 4, 
      pb: 3, 
      borderBottom: '1px solid var(--border-light)',
      '&:last-child': { borderBottom: 'none', mb: 0, pb: 0 }
    }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', sm: 'center' }, 
        flexDirection: { xs: 'column', sm: 'row' },
        gap: 1.5,
        mb: 2 
      }}>
        <Typography variant="subtitle1" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 1 }}>
          <span style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: castle.kingdomID === 0 && castle.type === 3 ? '#94a3b8' : 'var(--brand)'
          }}/>
          {title} <span style={{ color: 'var(--text-muted)', fontSize: '0.85em', fontWeight: 500 }}>{coordsStr}</span>
        </Typography>

        {/* Filters bar */}
        <Box sx={{ 
          display: 'flex', 
          gap: 0.8, 
          overflowX: { xs: 'auto', sm: 'visible' },
          width: { xs: '100%', sm: 'auto' },
          pb: { xs: 0.5, sm: 0 },
          flexWrap: { xs: 'nowrap', sm: 'wrap' },
          scrollBehavior: 'smooth',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' }
        }}>
          {filters.map(f => (
            <Button
              key={f.key}
              size="small"
              variant={activeFilter === f.key ? 'contained' : 'outlined'}
              onClick={() => setActiveFilter(f.key)}
              startIcon={f.icon}
              sx={{
                flexShrink: 0,
                borderRadius: '8px',
                px: 1.5,
                py: 0.4,
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'none',
                minWidth: 'auto',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                color: activeFilter === f.key ? '#000' : 'var(--text-primary)',
                background: activeFilter === f.key ? 'var(--brand) !important' : 'rgba(255, 255, 255, 0.01)',
                '&:hover': {
                  background: activeFilter === f.key ? 'var(--brand)' : 'rgba(255, 255, 255, 0.05)',
                  borderColor: 'rgba(255, 255, 255, 0.2)'
                }
              }}
            >
              {f.label}
            </Button>
          ))}
        </Box>
      </Box>

      {/* Horizontally Scrollable Row */}
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {showScrollArrows && (
          <IconButton 
            onClick={() => handleScroll('left')}
            sx={{
              position: 'absolute',
              left: isRtl ? 'auto' : '-16px',
              right: isRtl ? '-16px' : 'auto',
              zIndex: 2,
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid var(--border-light)',
              color: '#fff',
              backdropFilter: 'blur(8px)',
              '&:hover': { background: 'var(--brand)', color: '#000' }
            }}
            size="small"
          >
            {isRtl ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </IconButton>
        )}

        <Box 
          ref={scrollRef}
          sx={{
            display: 'flex',
            gap: { xs: 1, sm: 2 },
            overflowX: 'auto',
            width: '100%',
            py: 1.5,
            px: 0.5,
            scrollBehavior: 'smooth',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' }
          }}
        >
          {filteredUnits.length === 0 ? (
            <Box sx={{ 
              width: '100%', 
              py: 3, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: 1,
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              color: 'var(--text-muted)'
            }}>
              <AlertCircle size={16} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {__('noUnits') || (isRtl ? 'لا توجد عناصر في هذه الفئة' : 'No units in this category')}
              </Typography>
            </Box>
          ) : (
            filteredUnits.map((u, i) => {
              const category = classifyUnit(u)
              const name = getUnitName(u)
              const assetSrc = getUnitAsset(u)
              const catColor = getCategoryColor(category)

              return (
                <Box 
                  key={i}
                  sx={{
                    flex: '0 0 auto',
                    width: { xs: '110px', sm: '140px' },
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '14px',
                    padding: { xs: '14px 10px', sm: '18px 12px' },
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      borderColor: catColor,
                      boxShadow: `0 8px 20px -8px ${catColor}`,
                      background: 'rgba(255, 255, 255, 0.04)'
                    }
                  }}
                >
                  {/* Category dot/tag */}
                  <Box style={{
                    position: 'absolute',
                    top: '8px',
                    right: isRtl ? 'auto' : '8px',
                    left: isRtl ? '8px' : 'auto',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: catColor
                  }} />

                  {/* Image container */}
                  <Box sx={{ 
                    height: { xs: '44px', sm: '52px' },
                    width: { xs: '44px', sm: '52px' },
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '50%',
                    mb: { xs: 1.2, sm: 1.5 },
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}>
                    {assetSrc ? (
                      <img 
                        src={assetSrc} 
                        alt={name}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                          e.currentTarget.nextSibling.style.display = 'flex'
                        }}
                        style={{ maxHeight: '85%', maxWidth: '85%', objectFit: 'contain', padding: '1px' }}
                      />
                    ) : null}
                    <div style={{ 
                      display: assetSrc ? 'none' : 'flex',
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }}>
                      {getCategoryIcon(category)}
                    </div>
                  </Box>

                  {/* Name */}
                  <Typography 
                    variant="caption" 
                    align="center" 
                    sx={{ 
                      fontWeight: 700, 
                      color: 'var(--text-secondary)',
                      fontSize: { xs: '10px', sm: '12px' },
                      height: { xs: '28px', sm: '32px' },
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.25,
                      mb: 1.2
                    }}
                  >
                    {name}
                  </Typography>

                  {/* Amount */}
                  <Typography 
                    variant="body2" 
                    align="center" 
                    sx={{ 
                      fontWeight: 900,
                      color: 'var(--brand)',
                      background: 'transparent',
                      px: 0,
                      py: 0,
                      fontSize: { xs: '12px', sm: '14px' }
                    }}
                  >
                    {new Intl.NumberFormat(languageCode).format(u.amount)}
                  </Typography>
                </Box>
              )
            })
          )}
        </Box>

        {showScrollArrows && (
          <IconButton 
            onClick={() => handleScroll('right')}
            sx={{
              position: 'absolute',
              right: isRtl ? 'auto' : '-16px',
              left: isRtl ? '-16px' : 'auto',
              zIndex: 2,
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid var(--border-light)',
              color: '#fff',
              backdropFilter: 'blur(8px)',
              '&:hover': { background: 'var(--brand)', color: '#000' }
            }}
            size="small"
          >
            {isRtl ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </IconButton>
        )}
      </Box>
    </Box>
  )
}

export default function ArmyAndTools({ __, openMilitary: rawMilitary, languageCode }) {
  const [assets, setAssets] = React.useState(assetsCache || {})

  React.useEffect(() => {
    if (!assetsCache) {
      fetch('/assets.json')
        .then(res => res.json())
        .then(json => {
          assetsCache = json
          setAssets(json)
        })
        .catch(err => console.error("Failed to fetch assets.json in ArmyAndTools:", err))
    }
  }, [])

  if (!rawMilitary || !Array.isArray(rawMilitary)) {
    return <></>
  }

  // Sort castles by custom order:
  // 1. Great Empire (0)
  // 2. Everwinter Glacier (2)
  // 3. Burning Sands (1)
  // 4. Fire Peaks (3)
  // 5. Storm Islands (4)
  const KINGDOM_ORDER = {
    0: 1, // Great Empire
    2: 2, // Everwinter Glacier
    1: 3, // Burning Sands
    3: 4, // Fire Peaks
    4: 5  // Storm Islands
  }

  const sortedCastles = [...rawMilitary].sort((a, b) => {
    const orderA = KINGDOM_ORDER[a.kingdomID] || 99
    const orderB = KINGDOM_ORDER[b.kingdomID] || 99
    if (orderA !== orderB) {
      return orderA - orderB
    }
    // Sort main castle (type 1) before outposts (type 3)
    if (a.type !== b.type) {
      return a.type - b.type
    }
    // Stable sort for multiple outposts
    return a.id - b.id
  })

  // Track outpost indices for kingdomID === 0
  let outpostCount = 0

  return (
    <Box 
      onClick={e => e.stopPropagation()} 
      sx={{ 
        width: '100%', 
        maxWidth: '850px', 
        padding: { xs: '8px', sm: '16px' }, 
        boxSizing: 'border-box' 
      }}
    >
      <Paper sx={{ 
        maxHeight: '85vh', 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'auto', 
        width: '100%', 
        p: { xs: 1.5, sm: 3 },
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--border-light)',
        borderRadius: '16px',
        boxShadow: '0 24px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <Typography 
          variant="h6" 
          sx={{ 
            mb: { xs: 2, sm: 3 }, 
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
            fontWeight: 800, 
            fontFamily: "'Cairo', 'Outfit', sans-serif", 
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.2
          }}
        >
          <Swords size={22} style={{ color: 'var(--brand)' }} />
          {__("armyAndTools") || (languageCode === 'ar' ? "الجيش والأدوات" : "Army & Tools")}
        </Typography>

        <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
          {sortedCastles.map((castle, idx) => {
            let index = 0
            if (castle.kingdomID === 0 && castle.type === 3) {
              index = outpostCount
              outpostCount++
            }
            return (
              <CastleRow 
                key={castle.id || idx}
                castle={castle}
                outpostIndex={index}
                __={__}
                languageCode={languageCode}
                assets={assets}
              />
            )
          })}
        </Box>
      </Paper>
    </Box>
  )
}
