import * as React from 'react'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Button,
  Switch,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Slider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { ErrorType, ActionType, LogLevel } from '../types.js'
import dayjs from 'dayjs'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'

const TOOL_DETAILS_AR = {
  // Wood tools
  611: { name: 'كبش خشبي (Wood Ram)', desc: 'تقليل حماية البوابة: -10%' },
  614: { name: 'سلم خشبي (Wood Ladder)', desc: 'تقليل حماية الجدار: -10%' },
  617: { name: 'حزم خشبية للخندق (Wood Moat)', desc: 'تقليل حماية الخندق: -5%' },
  620: { name: 'دروع خشبية (Wood Shields)', desc: 'تقليل حماية رماة المدى: -5%' },

  // Iron tools
  641: { name: 'كبش حديدي (Premium Ram)', desc: 'تقليل حماية البوابة: -15%' },
  640: { name: 'سلم حديدي / برج حصار (Siege Tower)', desc: 'تقليل حماية الجدار: -15%' },
  642: { name: 'جسر خندق حديدي (Premium Moat Bridge)', desc: 'تقليل حماية الخندق: -10%' },
  635: { name: 'دروع حديدية (Premium Shields)', desc: 'تقليل حماية رماة المدى: -10%' },

  // Samurai Event tools
  25: { name: 'كبش الساموراي (Samurai Ram)', desc: 'تقليل حماية البوابة: -25% | زيادة عملات الساموراي: +300%' },
  26: { name: 'سلم الساموراي (Samurai Ladder)', desc: 'تقليل حماية الجدار: -25% | زيادة عملات الساموراي: +300%' },
  27: { name: 'درع الساموراي العادي (Samurai Shield)', desc: 'تقليل حماية رماة المدى: -20% | زيادة عملات الساموراي: +300%' },
  172: { name: 'درع الساموراي الياقوتي (Daimyo Shield - Ruby)', desc: 'تقليل حماية رماة المدى: -20% | زيادة عملات الساموراي: +500%' },
  557: { name: 'كبش الشوغون (Shogun Ram)', desc: 'تقليل حماية البوابة: -25% | زيادة عملات الساموراي: +600%' },
  558: { name: 'درع الساموراي الممتاز (Shogun Shield)', desc: 'تقليل حماية رماة المدى: -20% | زيادة عملات الساموراي: +600%' },
  559: { name: 'سلم الشوغون (Shogun Ladder)', desc: 'تقليل حماية الجدار: -25% | زيادة عملات الساموراي: +600%' },

  // Nomad Event tools
  141: { name: 'كبش البدو الياقوتي (Elite Nomad Ram)', desc: 'تقليل حماية البوابة: -25% | زيادة لوحات البدو/الخان: +500%' },
  142: { name: 'سلم البدو الياقوتي (Elite Nomad Ladder)', desc: 'تقليل حماية الجدار: -25% | زيادة لوحات البدو/الخان: +500%' },
  143: { name: 'درع البدو الياقوتي (Nomad Shield - Ruby)', desc: 'تقليل حماية رماة المدى: -20% | زيادة لوحات البدو/الخان: +500%' },
  167: { name: 'كبش النار المطور (Improved Fire Ram)', desc: 'تقليل حماية البوابة: -25% | زيادة لوحات البدو/الخان: +600%' },
  168: { name: 'سلم الشجرة المطور (Improved Tree Ladder)', desc: 'تقليل حماية الجدار: -25% | زيادة لوحات البدو/الخان: +600%' },
  169: { name: 'درع البدو الدوار المطور (Improved Nomad Shield)', desc: 'تقليل حماية رماة المدى: -20% | زيادة لوحات البدو/الخان: +600%' },
  560: { name: 'كبش البدو الأسطوري (Legendary Nomad Ram)', desc: 'تقليل حماية البوابة: -25% | زيادة لوحات البدو/الخان: +700%' },
  561: { name: 'سلم البدو الأسطوري (Legendary Nomad Ladder)', desc: 'تقليل حماية الجدار: -25% | زيادة لوحات البدو/الخان: +700%' },
  562: { name: 'درع البدو الممتاز (Elite Nomad Shield)', desc: 'تقليل حماية رماة المدى: -20% | زيادة لوحات البدو/الخان: +700%' },
  563: { name: 'معزز الغضب (Rage Boost)', desc: 'زيادة نقاط الغضب والألواح لحدث البدو والخان' },
  738: { name: 'كبش النار العادي (Fire Ram)', desc: 'تقليل حماية البوابة: -25% | زيادة لوحات البدو/الخان: +300%' },
  739: { name: 'درع البدو الدوار العادي (Nomad Shield)', desc: 'تقليل حماية رماة المدى: -20% | زيادة لوحات البدو/الخان: +300%' },
  740: { name: 'سلم الجذع العادي (Trunk Ladder)', desc: 'تقليل حماية الجدار: -25% | زيادة لوحات البدو/الخان: +300%' },
  775: { name: 'كبش بيريموند (Berimond Ram)', desc: 'تقليل حماية البوابة: -25% | خاص بحدث غزو بيريموند ومملكة بيريموند' },
  776: { name: 'سلم بيريموند (Berimond Ladder)', desc: 'تقليل حماية الجدار: -25% | خاص بحدث غزو بيريموند ومملكة بيريموند' },
  777: { name: 'خندق بيريموند (Berimond Moat)', desc: 'تقليل حماية الخندق: -20% | خاص بحدث غزو بيريموند ومملكة بيريموند' },
  778: { name: 'درع بيريموند (Berimond Shield)', desc: 'تقليل حماية رماة المدى: -20% | خاص بحدث غزو بيريموند ومملكة بيريموند' },

  // Samurai event boosters & chests
  28: { name: 'راية الساموراي (Samurai Banner)', desc: 'زيادة عملات الساموراي: +300% | زيادة قوة الهجوم المشاة: +30%' },
  29: { name: 'مانجانيق الساموراي (Samurai Ballista)', desc: 'زيادة عملات الساموراي: +300% | زيادة قوة الهجوم الرماة: +30%' },
  30: { name: 'معزز نقاط الساموراي (Samurai Point Boost)', desc: 'زيادة عملات الساموراي: +300%' },
  31: { name: 'معزز نقاط الساموراي المتقدم (Elite Samurai Point Boost)', desc: 'زيادة عملات الساموراي: +400%' },
  165: { name: 'حقيبة الشوغون (Case Of The Shogun)', desc: 'زيادة عملات الساموراي: +500%' },
  166: { name: 'صندوق الشوغون (Chest Of The Shogun)', desc: 'زيادة عملات الساموراي: +600%' },
  406: { name: 'صندوق عملات الساموراي الكبير (Large Samurai Token Chest)', desc: 'زيادة عملات الساموراي: +700%' },
  407: { name: 'صندوق عملات الساموراي الضخم (Huge Samurai Token Chest)', desc: 'زيادة عملات الساموراي: +800%' },
  510: { name: 'صندوق عملات الساموراي العملاق (Giant Samurai Token Chest)', desc: 'زيادة عملات الساموراي: +900%' },
  511: { name: 'صندوق عملات الساموراي الهائل (Enormous Samurai Token Chest)', desc: 'زيادة عملات الساموراي: +1000%' },
  512: { name: 'صندوق عملات الساموراي الجبار (Colossal Samurai Token Chest)', desc: 'زيادة عملات الساموراي: +1100%' },

  // Nomad tablet boosts & khan chests
  1: { name: 'معزز ألواح البدو (Nomad Tablet Boost)', desc: 'زيادة ألواح البدو/الخان: +300%' },
  107: { name: 'معزز ألواح الغضب البدوي (Nomad Rage Tablet Boost)', desc: 'زيادة ألواح البدو/الخان عند الغضب: +100%' },
  162: { name: 'صندوق الخان الفضي (Silver Khan Chest)', desc: 'زيادة ألواح الخان: +400%' },
  163: { name: 'صندوق الخان الذهبي (Gold Khan Chest)', desc: 'زيادة ألواح الخان: +500%' },
  164: { name: 'صندوق الخان الملكي (Royal Khan Chest)', desc: 'زيادة ألواح الخان: +600%' },
  243: { name: 'صندوق خان الفيكونت (Viscount Khan Chest)', desc: 'زيادة ألواح الخان: +700%' },
  244: { name: 'صندوق خان الإمبراطور (Emperor Khan Chest)', desc: 'زيادة ألواح الخان: +800%' },
  404: { name: 'صندوق ألواح الخان الكبير (Large Khan Tablet Chest)', desc: 'زيادة ألواح الخان: +900%' },
  405: { name: 'صندوق ألواح الخان الضخم (Huge Khan Tablet Chest)', desc: 'زيادة ألواح الخان: +1000%' },
  490: { name: 'صندوق ألواح البدو العملاق (Giant Nomad Tablet Chest)', desc: 'زيادة ألواح الخان: +1100%' },
  491: { name: 'صندوق ألواح البدو الهائل (Enormous Nomad Tablet Chest)', desc: 'زيادة ألواح الخان: +1200%' },
  492: { name: 'صندوق ألواح البدو الجبار (Colossal Nomad Tablet Chest)', desc: 'زيادة ألواح الخان: +1300%' },

  // Glory Event Banners
  660: { name: 'علم المجد العادي (Glory Flag - Standard)', desc: 'زيادة نقاط المجد: +100%' },
  661: { name: 'علم المجد الفاخر (Glory Banner - Premium)', desc: 'زيادة نقاط المجد: +200%' },
  77: { name: 'علم المجد النخبة (Glory Banner - Elite)', desc: 'زيادة نقاط المجد: +300%' },
  24: { name: 'علم المجد البطل (Glory Banner - Champion)', desc: 'زيادة نقاط المجد: +400%' },
  734: { name: 'راية ذيل الحصان (Horsetail Banner)', desc: 'زيادة نقاط المجد: +500%' },
  152: { name: 'الراية الملكية (Royal Banner)', desc: 'زيادة نقاط المجد: +600%' },
  153: { name: 'راية الملك (King\'s Banner)', desc: 'زيادة نقاط المجد: +800%' },
  239: { name: 'راية الفيكونت (Viscount Banner)', desc: 'زيادة نقاط المجد: +900%' },
  240: { name: 'راية الإمبراطور (Emperor\'s Banner)', desc: 'زيادة نقاط المجد: +1000%' },
  474: { name: 'راية الملكة العظمى (High Queen\'s Banner)', desc: 'زيادة نقاط المجد: +1100%' },
  475: { name: 'راية الملك العظيم (High King\'s Banner)', desc: 'زيادة نقاط المجد: +1200%' },
  476: { name: 'راية العاهل الأعلى (Supreme Monarch\'s Banner)', desc: 'زيادة نقاط المجد: +1300%' },
  774: { name: 'راية الغزاة المخصصة (Invasion Banner)', desc: 'زيادة نقاط المجد: +400%' },

  // Glory Event Wall, Gate, Moat & Shield tools
  564: { name: 'كبش النخبة المشترك (Elite Combo Ram)', desc: 'تقليل حماية البوابة: -20% | زيادة نقاط المجد: +900% | لحدث المجد والغزاة' },
  565: { name: 'برج الغزاة النخبة (Elite Invasion Wall Tool / Elite Tonnelon)', desc: 'تقليل حماية الجدار: -20% | زيادة نقاط المجد: +900% | لحدث المجد والغزاة' },
  566: { name: 'درع النخبة المشترك (Elite Combo Shield)', desc: 'تقليل حماية رماة المدى: -20% | زيادة نقاط المجد: +900% | لحدث المجد والغزاة' },
  770: { name: 'كبش الغزاة الفاخر (Premium Invasion Ram)', desc: 'تقليل حماية البوابة: -25% | لحدث المجد والغزاة' },
  771: { name: 'سلم الغزاة الفاخر (Premium Invasion Ladder)', desc: 'تقليل حماية الجدار: -25% | لحدث المجد والغزاة' },
  772: { name: 'خندق الغزاة الفاخر (Premium Invasion Moat Tool)', desc: 'تقليل حماية الخندق: -20% | لحدث المجد والغزاة' },
  773: { name: 'درع الغزاة الفاخر (Premium Invasion Shield)', desc: 'تقليل حماية رماة المدى: -20% | لحدث المجد والغزاة' },

  // Elite general tools
  648: { name: 'كبش النخبة (Elite Ram)', desc: 'تقليل حماية البوابة: -20%' },
  649: { name: 'سلم النخبة (Elite Ladder)', desc: 'تقليل حماية الجدار: -20%' },
  650: { name: 'حزم النخبة للخندق (Elite Moat)', desc: 'تقليل حماية الخندق: -15%' },
  651: { name: 'دروع النخبة (Elite Shields)', desc: 'تقليل حماية رماة المدى: -15%' },

  // Royal general tools
  154: { name: 'الكبش الملكي (Royal Ram)', desc: 'تقليل حماية البوابة: -20%' },
  156: { name: 'السلم الملكي (Royal Ladder)', desc: 'تقليل حماية الجدار: -20%' },
  158: { name: 'حزم الخندق الملكية (Royal Moat)', desc: 'تقليل حماية الخندق: -15%' },
  160: { name: 'الدروع الملكية (Royal Shields)', desc: 'تقليل حماية رماة المدى: -15%' },

  // Kings general tools
  155: { name: 'كبش الملك (King\'s Ram)', desc: 'تقليل حماية البوابة: -20%' },
  157: { name: 'سلم الملك (King\'s Ladder)', desc: 'تقليل حماية الجدار: -20%' },
  159: { name: 'حزم خندق الملك (King\'s Moat)', desc: 'تقليل حماية الخندق: -15%' },
  161: { name: 'دروع الملك (King\'s Shields)', desc: 'تقليل حماية رماة المدى: -15%' },

  // Other general tools
  732: { name: 'كبش السلحفاة (Tortoise)', desc: 'تقليل حماية البوابة: -15%' },
  733: { name: 'خطاف التسلق (Grappling Hook)', desc: 'تقليل حماية الجدار: -15%' },
  735: { name: 'دمية الفلاح (Peasant Doll)', desc: 'تقليل حماية رماة المدى: -10%' },

  // Berimond Event Boosters & Chests
  178: { name: 'معزز نقاط بيريموند البسيط (Low Berimond Point Boost)', desc: 'زيادة نقاط بيريموند: +100%' },
  16: { name: 'معزز نقاط بيريموند (Berimond Point Boost)', desc: 'زيادة نقاط بيريموند: +200%' },
  17: { name: 'معزز نقاط بيريموند المتقدم (Elite Berimond Point Boost)', desc: 'زيادة نقاط بيريموند: +300%' },
  241: { name: 'معزز نقاط بيريموند الفيكونت (Viscount Berimond Point Boost)', desc: 'زيادة نقاط بيريموند: +500%' },
  242: { name: 'معزز نقاط بيريموند الإمبراطور (Emperor Berimond Point Boost)', desc: 'زيادة نقاط بيريموند: +600%' },
  780: { name: 'صندوق معزز بيريموند الكبير (Berimond Point Chest)', desc: 'زيادة نقاط بيريموند: +2500%' },
  81: { name: 'معزز سمعة غزو بيريموند (Berimond Invasion Reputation Boost)', desc: 'زيادة سمعة غزو بيريموند: +100%' },
  82: { name: 'معزز سمعة غزو بيريموند المتقدم (Elite Berimond Invasion Reputation Boost)', desc: 'زيادة سمعة غزو بيريموند: +400%' },
};

const FILTER_LABELS_AR = {
  all: 'الكل (All)',
  wall: 'جدار (Wall)',
  shield: 'درع (Shield)',
  moat: 'خندق (Moat)',
  gate: 'بوابة (Gate)',
  other: 'صناديق ومعززات (Boosters)'
};

function clampTroopCount(rawValue, minimum = 32) {
  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? Math.max(minimum, Math.floor(parsed)) : minimum
}

function clampDailyAttackLimit(rawValue) {
  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 6500
}

function PluginOptionField({ option, pluginKey, userPlugins, channels, __ }) {
  userPlugins[pluginKey] ??= {}
  const [value, setValue] = React.useState(userPlugins[pluginKey][option.key] ?? option.default)
  const [showHelp, setShowHelp] = React.useState(false)
  const isTroopCountField = option.key === 'troopCount'
  const troopCountMinimum = pluginKey?.toLowerCase().includes('berimond') ? 26 : 32

  React.useEffect(() => {
    setValue(userPlugins[pluginKey][option.key] ?? option.default)
  }, [userPlugins, pluginKey, option.key, option.default])

  const onChange = (val) => {
    userPlugins[pluginKey][option.key] = val
    setValue(val)
  }

  const helperText = __(`${option.key}_desc`) !== `${option.key}_desc` ? __(`${option.key}_desc`) : ""

  const renderLabel = (labelKey) => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
        <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{__(labelKey)}</label>
        {helperText && (
          <span
            onClick={() => setShowHelp(!showHelp)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              background: showHelp ? 'var(--brand)' : 'rgba(255,255,255,0.08)',
              color: showHelp ? '#fff' : 'var(--text-secondary)',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginLeft: '6px',
              marginRight: '6px',
              transition: 'all 0.2s ease',
              border: '1px solid rgba(255,255,255,0.1)',
              userSelect: 'none'
            }}
          >
            ?
          </span>
        )}
      </div>
    )
  }

  const renderHelpText = () => {
    if (!showHelp || !helperText) return null
    return (
      <div style={{
        fontSize: '12.5px',
        color: 'var(--text-secondary)',
        marginTop: '6px',
        marginBottom: '12px',
        padding: '10px 14px',
        borderRadius: '8px',
        background: 'rgba(0,189,166,0.04)',
        borderLeft: '3px solid var(--brand)',
        lineHeight: '1.45',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {helperText}
      </div>
    )
  }

  switch (option.type) {
    case "Label":
      return (
        <Box sx={{ mt: 4, mb: 2, pb: 1, borderBottom: '1px solid var(--line)' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {__(option.key) || option.key}
          </Typography>
        </Box>
      )
    case "Text":
      return (
        <div style={{ marginBottom: '16px' }}>
          {renderLabel(option.key)}
          <input
            type={isTroopCountField ? "number" : "text"}
            min={isTroopCountField ? troopCountMinimum : undefined}
            step={isTroopCountField ? 1 : undefined}
            inputMode={isTroopCountField ? "numeric" : undefined}
            className="flat-input w-full"
            value={isTroopCountField ? String(clampTroopCount(value ?? option.default ?? troopCountMinimum, troopCountMinimum)) : (value || "")}
            onChange={e => {
              if (isTroopCountField) {
                onChange(String(clampTroopCount(e.target.value, troopCountMinimum)))
                return
              }
              onChange(e.target.value)
            }}
            placeholder={option.placeholder ? __(option.placeholder) : ""}
          />
          {renderHelpText()}
        </div>
      )
    case "Checkbox":
      return (
        <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id={`${pluginKey}-${option.key}`}
              checked={Boolean(value)}
              onChange={e => onChange(e.target.checked)}
              className="w-4 h-4 rounded text-brand bg-obsidian-800 border-white/10 focus:ring-brand focus:ring-2 focus:ring-offset-0"
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor={`${pluginKey}-${option.key}`} style={{ fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}>{__(option.key)}</label>
            {helperText && (
              <span
                onClick={() => setShowHelp(!showHelp)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: showHelp ? 'var(--brand)' : 'rgba(255,255,255,0.08)',
                  color: showHelp ? '#fff' : 'var(--text-secondary)',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: '1px solid rgba(255,255,255,0.1)',
                  userSelect: 'none'
                }}
              >
                ?
              </span>
            )}
          </div>
          {renderHelpText()}
        </div>
      )
    case "Channel":
      return (
        <div style={{ marginBottom: '16px' }}>
          {renderLabel(option.key)}
          <input
            type="text"
            className="flat-input w-full"
            value={value || ""}
            onChange={e => onChange(e.target.value)}
            placeholder="Enter Discord Channel ID"
          />
          {renderHelpText()}
        </div>
      )
    case "Select":
      return (
        <div style={{ marginBottom: '16px' }}>
          {renderLabel(option.key)}
          <select
            className="flat-input w-full"
            value={value ?? 0}
            onChange={e => onChange(Number(e.target.value))}
          >
            {option.selection?.map((e, i) => (
              <option value={i} key={i}>{__(e)}</option>
            ))}
          </select>
          {renderHelpText()}
        </div>
      )
    case "Slider":
      return (
        <div style={{ marginBottom: '16px' }}>
          {renderLabel(option.key)}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="range"
              min="0"
              max="100"
              className="flex-grow accent-brand"
              value={value ?? 0}
              onChange={e => onChange(Number(e.target.value))}
              style={{ height: '4px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '13px', fontWeight: 600, minWidth: '40px', textAlign: 'right' }}>{value ?? 0}%</span>
          </div>
          {renderHelpText()}
        </div>
      )
    case "Time":
      return (
        <div style={{ marginBottom: '16px' }}>
          {renderLabel(option.key)}
          <input
            type="time"
            className="flat-input w-full"
            value={value ? dayjs(value).format('HH:mm') : "00:00"}
            onChange={e => {
              const [h, m] = e.target.value.split(':')
              const date = dayjs().hour(Number(h)).minute(Number(m)).second(0)
              onChange(date.toISOString())
            }}
          />
          {renderHelpText()}
        </div>
      )
    default:
      return null
  }
}

export default function BotConfigurator({ plugin, user, usersStatus, plugins, channels, ws, __, onClose }) {
  const [activeTab, setActiveTab] = React.useState(0)
  const [activeSubTab, setActiveSubTab] = React.useState(0)
  const [logs, setLogs] = React.useState([])
  const [saveStatus, setSaveStatus] = React.useState('') // '', 'saving', 'saved'
  const status = usersStatus[user.id] || {}

  const [pluginActive, setPluginActive] = React.useState(Boolean(user.plugins[plugin.key]?.state))

  React.useEffect(() => {
    setPluginActive(Boolean(user.plugins[plugin.key]?.state))
  }, [user, plugin.key])

  // Custom Waves States & Helpers
  const [toolsData, setToolsData] = React.useState([])
  const [assetsMap, setAssetsMap] = React.useState({})
  const [loadingConfig, setLoadingConfig] = React.useState(true)
  const [customWavesEnabled, setCustomWavesEnabled] = React.useState(false)

  const defaultCustomWaves = React.useMemo(() => ({
    repeatWave4: true,
    waves: Array(4).fill(null).map(() => ({
      enabled: true,
      L_enabled: true,
      M_enabled: true,
      R_enabled: true,
      priority: 'default',
      L: Array(2).fill(null).map(() => ({ toolId: 0, quantity: 0 })),
      M: Array(3).fill(null).map(() => ({ toolId: 0, quantity: 0 })),
      R: Array(2).fill(null).map(() => ({ toolId: 0, quantity: 0 }))
    }))
  }), [])

  const [localCustomWaves, setLocalCustomWaves] = React.useState(() => {
    const cw = user.plugins[plugin.key]?.customWaves
    if (cw && Array.isArray(cw.waves)) {
      const parsed = JSON.parse(JSON.stringify(cw))
      parsed.waves.forEach(w => {
        if (w && w.priority === undefined) {
          w.priority = w.L_priority || w.M_priority || w.R_priority || 'default'
        }
      })
      return parsed
    }
    return JSON.parse(JSON.stringify(defaultCustomWaves))
  })

  const [editingSlot, setEditingSlot] = React.useState(null) // { waveIndex, section, slotIndex }
  const [toolSearchText, setToolSearchText] = React.useState('')
  const [selectedToolTypeFilter, setSelectedToolTypeFilter] = React.useState('all')
  const [dialogSelectedTool, setDialogSelectedTool] = React.useState(null)
  const [dialogQuantity, setDialogQuantity] = React.useState(1)

  React.useEffect(() => {
    let active = true
    const loadAssetsAndTools = async () => {
      try {
        const [toolsRes, assetsRes] = await Promise.all([
          fetch('/tools.json').then(r => r.json()),
          fetch('/assets.json').then(r => r.json())
        ])
        if (active) {
          setToolsData(toolsRes)
          setAssetsMap(assetsRes)
          setLoadingConfig(false)
        }
      } catch (err) {
        console.error('Failed to load tools or assets data', err)
      }
    }
    loadAssetsAndTools()
    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    const cw = user.plugins[plugin.key]?.customWaves
    if (cw && Array.isArray(cw.waves)) {
      const parsed = JSON.parse(JSON.stringify(cw))
      parsed.waves.forEach(w => {
        if (w && w.priority === undefined) {
          w.priority = w.L_priority || w.M_priority || w.R_priority || 'default'
        }
      })
      setLocalCustomWaves(parsed)
      setCustomWavesEnabled(true)
    } else {
      setLocalCustomWaves(JSON.parse(JSON.stringify(defaultCustomWaves)))
      setCustomWavesEnabled(false)
    }
  }, [plugin.key, user.id, defaultCustomWaves])

  const isCustomWavesSupported = React.useMemo(() => {
    return ['attackSamurai', 'attackNomads', 'attackKhan', 'attackBerimondInvasion', 'attackBerimondKingdom', 'attackBloodcrows', 'attackForeign'].includes(plugin.key)
  }, [plugin.key])

  const getWaveSectionSum = React.useCallback((wave, section, excludeSlotIndex = -1) => {
    const slots = wave[section] || []
    return slots.reduce((sum, slot, idx) => {
      if (idx === excludeSlotIndex) return sum
      return sum + (slot ? Number(slot.quantity || 0) : 0)
    }, 0)
  }, [])

  const getWaveSectionUniqueTypes = React.useCallback((wave, section, excludeSlotIndex = -1) => {
    const slots = wave[section] || []
    const uniqueTypes = new Set()
    slots.forEach((slot, idx) => {
      if (idx === excludeSlotIndex) return
      if (slot && slot.toolId) {
        uniqueTypes.add(slot.toolId)
      }
    })
    return uniqueTypes.size
  }, [])

  const handleApplyTool = (toolId, quantity) => {
    if (!editingSlot) return
    const { waveIndex, section, slotIndex } = editingSlot

    setLocalCustomWaves(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      next.waves[waveIndex][section][slotIndex] = toolId ? { toolId, quantity } : null
      return next
    })

    setEditingSlot(null)
  }

  const renderSlot = (waveIndex, section, slotIndex) => {
    const wave = localCustomWaves.waves[waveIndex]
    if (!wave) return null

    const slot = wave[section] && wave[section][slotIndex]
    const toolId = slot ? slot.toolId : 0
    const quantity = slot ? slot.quantity : 0

    const tool = toolId ? toolsData.find(t => t.id === toolId) : null
    const assetPath = tool ? assetsMap[tool.assetKey] : null
    const imageUrl = assetPath ? `/ggeProxyEmpire5/default/assets/${assetPath}.webp` : null

    const isFlankDisabled = (section === 'L' && wave.L_enabled === false) ||
      (section === 'M' && wave.M_enabled === false) ||
      (section === 'R' && wave.R_enabled === false)
    const isWaveDisabled = !wave.enabled || isFlankDisabled

    return (
      <Box
        key={slotIndex}
        onClick={() => {
          if (isWaveDisabled) return
          setEditingSlot({ waveIndex, section, slotIndex })
          setToolSearchText('')
          setSelectedToolTypeFilter('all')
          if (tool) {
            setDialogSelectedTool(tool)
            setDialogQuantity(quantity)
          } else {
            setDialogSelectedTool(null)
            setDialogQuantity(1)
          }
        }}
        sx={{
          position: 'relative',
          width: '50px',
          height: '50px',
          borderRadius: '8px',
          border: tool ? '1px solid rgba(255,255,255,0.15)' : '1px dashed rgba(255,255,255,0.15)',
          background: tool ? 'linear-gradient(135deg, rgba(20,30,48,0.7) 0%, rgba(36,59,85,0.7) 100%)' : 'rgba(0,0,0,0.25)',
          boxShadow: tool ? 'inset 0 0 6px rgba(0,0,0,0.5)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isWaveDisabled ? 'not-allowed' : 'pointer',
          opacity: isWaveDisabled ? 0.3 : 1,
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: isWaveDisabled ? 'rgba(255,255,255,0.15)' : 'var(--brand)',
            boxShadow: isWaveDisabled ? 'none' : '0 0 8px rgba(0, 189, 166, 0.25)',
            transform: isWaveDisabled ? 'none' : 'scale(1.05)',
          }
        }}
        title={tool ? (() => {
          const details = TOOL_DETAILS_AR[tool.id] || { name: tool.name, desc: `Bonus: ${tool.wallBonus || tool.gateBonus || tool.moatBonus || tool.defRangeBonus}%` }
          return `${details.name}\n${details.desc}`
        })() : (__('emptySlot') || 'خانة فارغة')}
      >
        {imageUrl ? (
          <img
            src={toolId ? `/tools/${toolId}.webp` : imageUrl}
            alt={tool.name || 'Tool'}
            style={{ width: '40px', height: '40px', objectFit: 'contain' }}
            onError={(e) => {
              const targetSrc = e.target.src
              if (imageUrl && !targetSrc.includes(imageUrl)) {
                e.target.src = imageUrl
              } else {
                e.target.style.display = 'none'
              }
            }}
          />
        ) : (
          <Typography sx={{ color: 'rgba(255,255,255,0.15)', fontSize: '18px', fontWeight: 'bold' }}>+</Typography>
        )}

        {tool && quantity > 0 && (
          <Box
            sx={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              background: 'var(--brand, #00bda6)',
              color: '#fff',
              fontSize: '9px',
              fontWeight: 800,
              px: '4px',
              py: '0.5px',
              borderRadius: '6px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            {quantity}
          </Box>
        )}
      </Box>
    )
  }

  const handleToggleActive = (checked) => {
    user.plugins[plugin.key] ??= {}
    user.plugins[plugin.key].state = checked
    setPluginActive(checked)
  }

  // Check if there is an attack limit or specific attack settings in options
  const hasAttackSettings = plugin.key?.toLowerCase().includes('attack') || plugin.key?.toLowerCase().includes('berimond') || plugin.key?.toLowerCase().includes('storm')

  const tabsList = React.useMemo(() => {
    const list = [
      { key: 'dash', label: 'Dash' },
      { key: 'settings', label: 'Settings' }
    ]
    if (hasAttackSettings) {
      list.push({ key: 'attack', label: 'Attack Settings' })
    }
    list.push({ key: 'console', label: 'Console' })
    list.push({ key: 'payment', label: 'Payment' })
    return list
  }, [hasAttackSettings])

  // Request logs if on console tab (use dynamic key to support variable tab count)
  const isConsoleTab = tabsList[activeTab]?.key === 'console'
  React.useEffect(() => {
    if (isConsoleTab) {
      ws.send(JSON.stringify([ErrorType.Success, ActionType.GetLogs, user]))

      const handleLogs = (msg) => {
        let [err, action, obj] = JSON.parse(msg.data.toString())
        if (Number(action) === ActionType.GetLogs && Number(err) === ErrorType.Success) {
          const logLines = obj[0].splice(obj[1], obj[0].length - 1).concat(obj[0]).map((logObj, index) => {
            let items = logObj[1].map(__).join("")
            let color = '#a8bdd8'
            if (logObj[0] === LogLevel.Error) color = '#ff6b6b'
            if (logObj[0] === LogLevel.Warn) color = '#ffd700'
            return <div key={index} style={{ color, fontFamily: 'monospace', fontSize: '12px', marginBottom: '4px' }}>{items}</div>
          }).reverse()
          setLogs(logLines)
        }
      }

      ws.addEventListener('message', handleLogs)
      return () => {
        ws.removeEventListener('message', handleLogs)
        ws.send(JSON.stringify([ErrorType.Success, ActionType.GetLogs, undefined]))
      }
    }
  }, [isConsoleTab, ws, user])

  // Save changes
  const handleSave = () => {
    if (plugin.pluginOptions?.some(opt => opt.key === 'troopCount')) {
      user.plugins[plugin.key] ??= {}
      const troopCountMinimum = plugin.key?.toLowerCase().includes('berimond') ? 26 : 32
      user.plugins[plugin.key].troopCount = String(clampTroopCount(user.plugins[plugin.key].troopCount ?? troopCountMinimum, troopCountMinimum))
    }
    const isAttackLike = plugin.key?.toLowerCase().includes('attack') || plugin.key?.toLowerCase().includes('berimond') || plugin.key?.toLowerCase().includes('storm')
    const hasDailyAttackLimit = isAttackLike || plugin.pluginOptions?.some(opt => opt.key === 'maxDailyAttackCount' || opt.key === 'attackLimit')
    if (hasDailyAttackLimit) {
      user.plugins[plugin.key] ??= {}
      const dailyAttackLimit = clampDailyAttackLimit(
        user.plugins[plugin.key].maxDailyAttackCount ?? user.plugins[plugin.key].attackLimit ?? 6500
      )
      user.plugins[plugin.key].maxDailyAttackCount = String(dailyAttackLimit)
      user.plugins[plugin.key].attackLimit = String(dailyAttackLimit)
    }
    if (isCustomWavesSupported) {
      user.plugins[plugin.key] ??= {}
      if (customWavesEnabled) {
        user.plugins[plugin.key].customWaves = localCustomWaves
      } else {
        user.plugins[plugin.key].customWaves = null
      }
    }
    setSaveStatus('saving')
    ws.send(JSON.stringify([ErrorType.Success, ActionType.SetUser, user]))
    setTimeout(() => {
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(''), 2000)
    }, 500)
  }

  React.useEffect(() => {
    setActiveSubTab(0)
  }, [plugin.key])

  const { generalOptions, timeSkipsOptions, horseAndAttackOptions, troopTypeOptionsList } = React.useMemo(() => {
    const general = []
    const skips = []
    const horseAttack = []
    const troopTypes = []

    let currentLabel = ""
    plugin.pluginOptions?.forEach(opt => {
      if (opt.type === 'Label') {
        currentLabel = opt.key
      }

      if (!opt.key) {
        general.push(opt)
        return
      }

      const isTroopType =
        opt.key === 'troopTypeSettings' ||
        opt.key === 'meadLevelSettings' ||
        opt.key === 'useMeadTroops' ||
        opt.key === 'useFoodTroops' ||
        opt.key === 'prioritizeFoodOverMead' ||
        opt.key === 'useBeefTroops' ||
        opt.key === 'meadMinAttackLevel' ||
        opt.key === 'meadMaxAttackLevel' ||
        currentLabel === 'troopTypeSettings' ||
        currentLabel === 'meadLevelSettings'

      const isSkip =
        opt.key === 'useTimeSkips' ||
        opt.key === 'timeSkipsSettings' ||
        opt.key === 'skipTypes' ||
        opt.key === 'bypassSkipTypeFilter' ||
        opt.key === 'upgradeTowers' ||
        opt.key === '1Minute' ||
        opt.key === '5Minute' ||
        opt.key === '10Minute' ||
        opt.key === '30Minute' ||
        opt.key === '1Hour' ||
        opt.key === '5Hour' ||
        opt.key === '24Hour' ||
        opt.key.endsWith('Minute') ||
        opt.key.endsWith('Hour') ||
        currentLabel === 'timeSkipsSettings' ||
        currentLabel === 'skipTypes'

      const isHorseAttack =
        opt.key === 'commanderWhiteList' ||
        opt.key === 'useFeather' ||
        opt.key === 'useCoin' ||
        opt.key === 'useFood' ||
        opt.key === 'horseSettings' ||
        opt.key === 'attackSettings' ||
        opt.key === 'attackLeft' ||
        opt.key === 'attackMiddle' ||
        opt.key === 'attackRight' ||
        opt.key === 'attackCourtyard' ||
        opt.key === 'maxWaves' ||
        opt.key === 'attackDelaySeconds' ||
        opt.key === 'attackDelayRandomizationSeconds' ||
        opt.key === 'globalAttackGapSeconds' ||
        opt.key.startsWith('allowLvl') ||
        currentLabel === 'horseSettings' ||
        currentLabel === 'attackSettings'

      const isExcludedFromSettingsTab =
        opt.key === 'useFeather' ||
        opt.key === 'useCoin' ||
        opt.key === 'useFood' ||
        opt.key === 'scoreShutoff' ||
        opt.key === 'requireLaddersAndRams'

      // Troop type + score shutoff → moved to Attack Settings tab (not Settings)
      if (isExcludedFromSettingsTab) {
        // Excluded from settings tab subtabs because it is rendered in the main Attack Settings tab
      } else if (isTroopType) {
        troopTypes.push(opt)
      } else if (isSkip) {
        skips.push(opt)
      } else if (isHorseAttack) {
        horseAttack.push(opt)
      } else {
        general.push(opt)
      }
    })

    return {
      generalOptions: general,
      timeSkipsOptions: skips,
      horseAndAttackOptions: horseAttack,
      troopTypeOptionsList: troopTypes,
    }
  }, [plugin.pluginOptions])

  const subTabs = React.useMemo(() => {
    const list = []
    if (generalOptions.length > 0) {
      list.push({ key: 'general', label: __('generalSettings') !== 'generalSettings' ? __('generalSettings') : 'General Settings', options: generalOptions })
    }
    if (timeSkipsOptions.length > 0) {
      list.push({ key: 'skips', label: __('timeSkipsSettings') !== 'timeSkipsSettings' ? __('timeSkipsSettings') : 'Time Skips', options: timeSkipsOptions })
    }
    if (horseAndAttackOptions.length > 0) {
      list.push({ key: 'horseAttack', label: __('horseAndAttackSettings') !== 'horseAndAttackSettings' ? __('horseAndAttackSettings') : 'Horse & Attack', options: horseAndAttackOptions })
    }
    // troopTypeOptionsList moved to Attack Settings tab — not shown here anymore
    return list
  }, [generalOptions, timeSkipsOptions, horseAndAttackOptions, __])

  const currentSubTabIdx = activeSubTab >= subTabs.length ? 0 : activeSubTab

  return (
    <Box sx={{ width: '100%', animation: 'fadeIn 0.25s ease' }}>
      {/* Top Header Card */}
      <Paper sx={{ p: 2.5, mb: 3, display: 'flex', alignItems: 'center', gap: 2, border: '1px solid var(--border-light)' }} elevation={0}>
        <Button
          variant="outlined"
          onClick={onClose}
          startIcon={<ArrowBackIcon />}
          size="small"
          sx={{ border: '1px solid var(--border-light) !important' }}
        >
          {__('back') || 'رجوع'}
        </Button>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {__(plugin.key) || plugin.key} {__('configuration') || 'الإعدادات'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {__('manageAndConfigure') || 'تعديل الخصائص وإدارة عمل البوت'} — {user.name}
          </Typography>
        </Box>
      </Paper>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, val) => {
          setActiveTab(val);
        }}
        sx={{
          mb: 3.5,
          borderBottom: '1px solid var(--border-light)',
          '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', px: 3 }
        }}
      >
        {tabsList.map((t, idx) => (
          <Tab label={t.label} key={idx} />
        ))}
      </Tabs>

      {/* Tab Panels */}
      <Box sx={{ minHeight: '300px' }}>
        {/* DASH TAB */}
        {tabsList[activeTab]?.key === 'dash' && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={7}>
              <Paper sx={{ p: 3, border: '1px solid var(--border-light)' }} elevation={0}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                  {__('basicInformation') || 'المعلومات الأساسية'}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', pb: 1.5 }}>
                    <Typography color="text.secondary" variant="body2">{__('gameEmail') || 'Game Email'}</Typography>
                    <Typography fontWeight={600} variant="body2">{user.name}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', pb: 1.5 }}>
                    <Typography color="text.secondary" variant="body2">{__('server') || 'Server'}</Typography>
                    <Typography fontWeight={600} variant="body2">{user.server}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', pb: 1.5 }}>
                    <Typography color="text.secondary" variant="body2">{__('version') || 'Version'}</Typography>
                    <Typography fontWeight={600} variant="body2">1.3.6</Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>

            <Grid item xs={12} md={5}>
              <Paper sx={{ p: 3, border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px' }} elevation={0}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                  {__(plugin.key) || plugin.key}
                </Typography>
                <Chip
                  label={user.plugins[plugin.key]?.state ? 'Online' : 'Offline'}
                  color={user.plugins[plugin.key]?.state ? 'success' : 'default'}
                  sx={{ fontWeight: 700, mb: 2 }}
                />
                <Switch
                  checked={Boolean(user.plugins[plugin.key]?.state)}
                  color="success"
                  onChange={(e) => {
                    user.plugins[plugin.key] ??= {}
                    user.plugins[plugin.key].state = e.target.checked
                    ws.send(JSON.stringify([ErrorType.Success, ActionType.SetUser, user]))
                  }}
                />
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* SETTINGS TAB */}
        {tabsList[activeTab]?.key === 'settings' && (
          <Paper sx={{ p: 3, border: '1px solid var(--border-light)' }} elevation={0}>
            {/* Main Plugin Enable/Disable Switch at the top */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 3,
              pb: 2,
              borderBottom: '1px solid var(--line)',
              background: 'rgba(255,255,255,0.01)',
              p: 2,
              borderRadius: '8px',
              border: '1px solid var(--line)'
            }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)' }}>
                  {__('activatePlugin') || 'تفعيل هذا البلاجن (Activate Plugin)'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {__('activatePluginDesc') || 'تشغيل أو إيقاف عمل البلاجن بالكامل في الحساب'}
                </Typography>
              </Box>
              <Switch
                checked={pluginActive}
                color="success"
                onChange={(e) => handleToggleActive(e.target.checked)}
              />
            </Box>

            {subTabs.length > 1 && (
              <Box sx={{ borderBottom: 1, borderColor: 'var(--line)', mb: 3 }}>
                <Tabs
                  value={currentSubTabIdx}
                  onChange={(_, val) => setActiveSubTab(val)}
                  sx={{
                    minHeight: '40px',
                    '& .MuiTab-root': {
                      minHeight: '40px',
                      py: 1,
                      px: 2,
                      fontSize: '12.5px',
                      fontWeight: 700,
                      textTransform: 'none'
                    }
                  }}
                >
                  {subTabs.map((st, idx) => (
                    <Tab label={st.label} key={idx} />
                  ))}
                </Tabs>
              </Box>
            )}

            <Box>
              {subTabs[currentSubTabIdx]?.options?.map((option, i) => (
                <PluginOptionField
                  option={option}
                  pluginKey={plugin.key}
                  userPlugins={user.plugins}
                  channels={channels}
                  __={__}
                  key={i}
                />
              ))}

              {(!plugin.pluginOptions || plugin.pluginOptions.length === 0) && (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  {__('noOptionsAvailable') || 'لا توجد خيارات قابلة للتعديل.'}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button
                variant="contained"
                color={saveStatus === 'saved' ? 'success' : 'primary'}
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? (__('saving') || 'جاري الحفظ...') :
                  saveStatus === 'saved' ? (__('saved') || 'تم الحفظ! ✓') :
                    (__('save') || 'حفظ الإعدادات')}
              </Button>
            </Box>
          </Paper>
        )}

        {/* ATTACK SETTINGS TAB */}
        {tabsList[activeTab]?.key === 'attack' && hasAttackSettings && (
          <Paper sx={{ p: 3, border: '1px solid var(--border-light)' }} elevation={0}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
              ⚔️ {__('attackSettings') || 'إعدادات الهجوم'}
            </Typography>

            <Box sx={{ maxWidth: '500px' }}>
              <PluginOptionField
                option={{ key: 'maxDailyAttackCount', type: 'Text', default: '6500' }}
                pluginKey={plugin.key}
                userPlugins={user.plugins}
                __={__}
              />
              <PluginOptionField
                option={{ key: 'minimumRubiesPerAttack', type: 'Text', default: '0' }}
                pluginKey={plugin.key}
                userPlugins={user.plugins}
                __={__}
              />
              <PluginOptionField
                option={{ key: 'stopAttackingAfterDefeat', type: 'Checkbox', default: false }}
                pluginKey={plugin.key}
                userPlugins={user.plugins}
                __={__}
              />

              {/* useFeather (from plugin options, if present) */}
              {plugin.pluginOptions?.some(o => o.key === 'useFeather') && (
                <PluginOptionField
                  option={plugin.pluginOptions.find(o => o.key === 'useFeather')}
                  pluginKey={plugin.key}
                  userPlugins={user.plugins}
                  __={__}
                />
              )}

              {/* useCoin (from plugin options, if present) */}
              {plugin.pluginOptions?.some(o => o.key === 'useCoin') && (
                <PluginOptionField
                  option={plugin.pluginOptions.find(o => o.key === 'useCoin')}
                  pluginKey={plugin.key}
                  userPlugins={user.plugins}
                  __={__}
                />
              )}

              {/* Score Shutoff (from plugin options, if present) */}
              {plugin.pluginOptions?.some(o => o.key === 'scoreShutoff') && (
                <PluginOptionField
                  option={plugin.pluginOptions.find(o => o.key === 'scoreShutoff')}
                  pluginKey={plugin.key}
                  userPlugins={user.plugins}
                  __={__}
                />
              )}

              {/* requireLaddersAndRams (from plugin options, if present) */}
              {plugin.pluginOptions?.some(o => o.key === 'requireLaddersAndRams') && (
                <PluginOptionField
                  option={plugin.pluginOptions.find(o => o.key === 'requireLaddersAndRams')}
                  pluginKey={plugin.key}
                  userPlugins={user.plugins}
                  __={__}
                />
              )}
            </Box>

            {/* ── Troop Types Section ── */}
            {troopTypeOptionsList.length > 0 && (
              <Box sx={{ borderTop: '1px solid var(--line)', pt: 3, mt: 3 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '15px', mb: 2, color: 'var(--text-primary)' }}>
                  🪖 {__('troopTypeSettings') || 'أنواع الجنود (Troop Types)'}
                </Typography>

                {/* Beef troops warning */}
                {Boolean(user.plugins[plugin.key]?.useBeefTroops) && (
                  <Box sx={{
                    mb: 2, p: 2, borderRadius: '8px',
                    background: 'rgba(255, 180, 0, 0.08)',
                    border: '1px solid rgba(255, 180, 0, 0.3)',
                    display: 'flex', gap: 1.5, alignItems: 'flex-start'
                  }}>
                    <Typography sx={{ fontSize: '18px', lineHeight: 1 }}>⚠️</Typography>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#ffb400', mb: 0.5 }}>
                        {__('beefTroopsWarningTitle') || 'تحذير — جنود اللحمة (Beef Troops)'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,180,0,0.85)', lineHeight: 1.5 }}>
                        {__('beefTroopsWarningDesc') || 'جنود اللحمة هي أقوى جنودك وخسارتها صعبة وغالية. تأكد أنك تريد استخدامها في هذا الحدث قبل تفعيل هذا الخيار.'}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {troopTypeOptionsList.map((option, i) => (
                  <PluginOptionField
                    option={option}
                    pluginKey={plugin.key}
                    userPlugins={user.plugins}
                    __={__}
                    key={i}
                  />
                ))}
              </Box>
            )}

            {/* Custom Wave layouts for Samurai, Nomad, Khan */}
            {isCustomWavesSupported && (
              <Box sx={{ borderTop: '1px solid var(--line)', pt: 3.5, mt: 3.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-primary)' }}>
                      📐 {__('customWaveLayout') || 'تخطيط موجات الهجوم المخصص (Custom Wave Layout)'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {__('customWaveLayoutDesc') || 'قم بتخصيص الأدوات والكميات لكل جناح في موجات الهجوم يدويًا'}
                    </Typography>
                  </Box>
                  <Switch
                    checked={customWavesEnabled}
                    color="primary"
                    onChange={(e) => setCustomWavesEnabled(e.target.checked)}
                  />
                </Box>

                {customWavesEnabled && (
                  <Box sx={{ animation: 'fadeIn 0.25s ease' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={Boolean(localCustomWaves.repeatWave4)}
                          size="small"
                          color="primary"
                          onChange={(e) => {
                            setLocalCustomWaves(prev => ({
                              ...prev,
                              repeatWave4: e.target.checked
                            }))
                          }}
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                          🔄 {__('repeatWave4') || 'تكرار إعدادات الموجة الرابعة للموجات اللاحقة (5+)'}
                        </Typography>
                      }
                      sx={{ mb: 0.5 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3, pl: 4, fontStyle: 'italic', lineHeight: 1.45 }}>
                      💡 عند تفعيل هذا الخيار، سيتم تطبيق إعدادات الأدوات المحددة للموجة الرابعة تلقائيًا على جميع الموجات اللاحقة (مثل الموجة الخامسة والسادسة إلخ) أثناء إرسال الهجوم.
                    </Typography>

                    {/* Waves table */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {localCustomWaves.waves.map((wave, wIdx) => {
                        const lSum = getWaveSectionSum(wave, 'L')
                        const mSum = getWaveSectionSum(wave, 'M')
                        const rSum = getWaveSectionSum(wave, 'R')

                        return (
                          <Paper
                            key={wIdx}
                            sx={{
                              p: 2,
                              border: '1px solid var(--border-light)',
                              background: 'rgba(255,255,255,0.01)',
                              borderRadius: '12px',
                              opacity: wave.enabled ? 1 : 0.6,
                              transition: 'all 0.2s ease',
                              '&:hover': {
                                background: 'rgba(255,255,255,0.02)',
                                borderColor: 'var(--brand)'
                              }
                            }}
                            elevation={0}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, pb: 1, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Checkbox
                                  checked={Boolean(wave.enabled)}
                                  size="small"
                                  color="success"
                                  onChange={(e) => {
                                    setLocalCustomWaves(prev => {
                                      const next = JSON.parse(JSON.stringify(prev))
                                      next.waves[wIdx].enabled = e.target.checked
                                      return next
                                    })
                                  }}
                                />
                                <Typography sx={{ fontWeight: 800, fontSize: '13.5px', mr: 2 }}>
                                  🌊 {__('waveIndex') || 'الموجة'} {wIdx + 1}
                                </Typography>
                                {wave.enabled && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="caption" sx={{ fontSize: '10.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                      {__('troopPriority') || 'أولوية الجنود'}:
                                    </Typography>
                                    <select
                                      value={wave.priority || 'default'}
                                      onChange={(e) => {
                                        setLocalCustomWaves(prev => {
                                          const next = JSON.parse(JSON.stringify(prev))
                                          next.waves[wIdx].priority = e.target.value
                                          return next
                                        })
                                      }}
                                      style={{
                                        fontSize: '11px',
                                        background: '#000',
                                        color: '#fff',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '4px',
                                        padding: '2px 8px',
                                        cursor: 'pointer',
                                        minWidth: '130px'
                                      }}
                                    >
                                      <option value="default">🤖 {__('priorityDefault') || 'تلقائي (البوت يقرر)'}</option>
                                      <option value="ranged">🏹 {__('priorityRanged') || 'رماة (Ranged)'}</option>
                                      <option value="melee">⚔️ {__('priorityMelee') || 'اشتباك (Melee)'}</option>
                                    </select>
                                  </Box>
                                )}
                              </Box>

                              <Typography variant="caption" sx={{ color: wave.enabled ? 'success.main' : 'text.disabled', fontWeight: 700 }}>
                                {wave.enabled ? (
                                  __('active') || 'نشطة (Active)'
                                ) : (
                                  __('ignoredEmpty') || 'تجاهل / إرسال فارغة (Bypassed Empty)'
                                )}
                              </Typography>
                            </Box>

                            {wave.enabled && (
                              <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                                {/* Left Flank */}
                                <Grid item xs={12} md={3.5}>
                                  <Box sx={{ p: 1.5, borderRadius: '8px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)', opacity: wave.L_enabled !== false ? 1 : 0.5, transition: 'all 0.2s ease' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, alignItems: 'center' }}>
                                      <FormControlLabel
                                        control={
                                          <Checkbox
                                            size="small"
                                            checked={wave.L_enabled !== false}
                                            onChange={(e) => {
                                              setLocalCustomWaves(prev => {
                                                const next = JSON.parse(JSON.stringify(prev))
                                                next.waves[wIdx].L_enabled = e.target.checked
                                                return next
                                              })
                                            }}
                                          />
                                        }
                                        label={
                                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                                            ⬅️ {__('leftFlank') || 'الجناح الأيسر'}
                                          </Typography>
                                        }
                                        sx={{ m: 0 }}
                                      />
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          fontWeight: 800,
                                          color: lSum > 40 ? 'error.main' : 'var(--text-muted)'
                                        }}
                                      >
                                        {lSum} / 40
                                      </Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap' }}>
                                      {Array(2).fill(null).map((_, sIdx) => renderSlot(wIdx, 'L', sIdx))}
                                    </Box>
                                  </Box>
                                </Grid>

                                {/* Center */}
                                <Grid item xs={12} md={5}>
                                  <Box sx={{ p: 1.5, borderRadius: '8px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)', opacity: wave.M_enabled !== false ? 1 : 0.5, transition: 'all 0.2s ease' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, alignItems: 'center' }}>
                                      <FormControlLabel
                                        control={
                                          <Checkbox
                                            size="small"
                                            checked={wave.M_enabled !== false}
                                            onChange={(e) => {
                                              setLocalCustomWaves(prev => {
                                                const next = JSON.parse(JSON.stringify(prev))
                                                next.waves[wIdx].M_enabled = e.target.checked
                                                return next
                                              })
                                            }}
                                          />
                                        }
                                        label={
                                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                                            🎯 {__('centerFlank') || 'الوسط'}
                                          </Typography>
                                        }
                                        sx={{ m: 0 }}
                                      />
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          fontWeight: 800,
                                          color: mSum > 50 ? 'error.main' : 'var(--text-muted)'
                                        }}
                                      >
                                        {mSum} / 50
                                      </Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap' }}>
                                      {Array(3).fill(null).map((_, sIdx) => renderSlot(wIdx, 'M', sIdx))}
                                    </Box>
                                  </Box>
                                </Grid>

                                {/* Right Flank */}
                                <Grid item xs={12} md={3.5}>
                                  <Box sx={{ p: 1.5, borderRadius: '8px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.03)', opacity: wave.R_enabled !== false ? 1 : 0.5, transition: 'all 0.2s ease' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5, alignItems: 'center' }}>
                                      <FormControlLabel
                                        control={
                                          <Checkbox
                                            size="small"
                                            checked={wave.R_enabled !== false}
                                            onChange={(e) => {
                                              setLocalCustomWaves(prev => {
                                                const next = JSON.parse(JSON.stringify(prev))
                                                next.waves[wIdx].R_enabled = e.target.checked
                                                return next
                                              })
                                            }}
                                          />
                                        }
                                        label={
                                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                                            ➡️ {__('rightFlank') || 'الجناح الأيمن'}
                                          </Typography>
                                        }
                                        sx={{ m: 0 }}
                                      />
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          fontWeight: 800,
                                          color: rSum > 40 ? 'error.main' : 'var(--text-muted)'
                                        }}
                                      >
                                        {rSum} / 40
                                      </Typography>
                                    </Box>

                                    <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap' }}>
                                      {Array(2).fill(null).map((_, sIdx) => renderSlot(wIdx, 'R', sIdx))}
                                    </Box>
                                  </Box>
                                </Grid>
                              </Grid>
                            )}
                          </Paper>
                        )
                      })}
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button
                variant="contained"
                color={saveStatus === 'saved' ? 'success' : 'primary'}
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
              >
                {saveStatus === 'saving' ? (__('saving') || 'جاري الحفظ...') :
                  saveStatus === 'saved' ? (__('saved') || 'تم الحفظ! ✓') :
                    (__('save') || 'حفظ الإعدادات')}
              </Button>
            </Box>
          </Paper>
        )}

        {/* CONSOLE TAB */}
        {tabsList[activeTab]?.key === 'console' && (
          <Paper sx={{ p: 2.5, bgcolor: '#05080f', border: '1px solid var(--border-light)', borderRadius: '8px', minHeight: '300px', maxHeight: '500px', overflowY: 'auto' }} elevation={0}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, borderBottom: '1px solid rgba(255,255,255,0.05)', pb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'primary.main' }}>
                Console Output
              </Typography>
              <Button size="small" variant="text" onClick={() => setLogs([])}>
                {__('clearLog') || 'Clear log'}
              </Button>
            </Box>
            <Box>
              {logs.length > 0 ? logs : (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', pl: 1 }}>
                  Waiting for log output...
                </Typography>
              )}
            </Box>
          </Paper>
        )}

        {/* PAYMENT TAB */}
        {tabsList[activeTab]?.key === 'payment' && (
          <Paper sx={{ p: 3, border: '1px solid var(--border-light)' }} elevation={0}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              💳 Subscription Billing Info
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Manage accounts plan billing and direct upgrades.
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 2, border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.01)' }}>
                  <Typography variant="caption" color="text.secondary">Current Limit</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', mt: 0.5 }}>
                    2 Workers
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ p: 2, border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', bgcolor: 'rgba(255,255,255,0.01)' }}>
                  <Typography variant="caption" color="text.secondary">Price Rate</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, color: 'secondary.main', mt: 0.5 }}>
                    300 EGP / Month
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        )}
      </Box>

      {/* Dialog for selecting tools */}
      <Dialog
        open={Boolean(editingSlot)}
        onClose={() => setEditingSlot(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            background: 'var(--bg, #0b111e)',
            border: '1px solid var(--border-light, rgba(255,255,255,0.08))',
            color: 'var(--text-primary, #fff)',
            borderRadius: '16px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.6)'
          }
        }}
      >
        {editingSlot && (() => {
          const { waveIndex, section, slotIndex } = editingSlot
          const wave = localCustomWaves.waves[waveIndex]

          // Limits check
          const currentSum = getWaveSectionSum(wave, section, slotIndex)
          const maxAllowed = section === 'M' ? 50 : 40
          const remainingCapacity = Math.max(0, maxAllowed - currentSum)

          // Event check
          const currentEvent = plugin.key === 'attackSamurai' ? 'samurai'
            : plugin.key === 'attackNomads' ? 'nomad'
              : plugin.key === 'attackKhan' ? 'nomad'
                : (plugin.key === 'attackBerimondInvasion' || plugin.key === 'attackBerimondKingdom') ? 'berimond'
                  : (plugin.key === 'attackBloodcrows' || plugin.key === 'attackForeign') ? 'glory'
                    : 'general'

          // Filter tools list
          const filteredTools = toolsData.filter(t => {
            // Gate tools (rams) are not allowed on flanks, so filter them out completely
            if (section !== 'M' && t.type === 'gate') return false

            // Always include event-specific tools for the current event (shields, rams, ladders, boosters, chests)
            const isCurrentEventTool = t.event === currentEvent ||
              (currentEvent === 'glory' && t.usageEventID && (t.usageEventID.split(',').includes('103') || t.usageEventID.split(',').includes('71')))

            // General tools (wood, iron, elite, royal, kings, etc. attack tools)
            const isGeneralTool = t.event === 'general'

            // Exclude tools from other events entirely (don't even show them grayed out)
            if (!isCurrentEventTool && !isGeneralTool) return false

            // Filter by search text
            if (toolSearchText) {
              const term = toolSearchText.toLowerCase()
              const details = TOOL_DETAILS_AR[t.id]
              const matchesSearch =
                t.name.toLowerCase().includes(term) ||
                (t.assetKey && t.assetKey.toLowerCase().includes(term)) ||
                (details && details.name.toLowerCase().includes(term))
              if (!matchesSearch) return false
            }
            // Filter by type tab
            if (selectedToolTypeFilter !== 'all') {
              if (t.type !== selectedToolTypeFilter) return false
            }
            return true
          })

          const slot = wave[section] && wave[section][slotIndex]
          const toolId = slot ? slot.toolId : 0
          const quantity = slot ? slot.quantity : 0

          return (
            <>
              <DialogTitle sx={{ fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.05)', pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    🛠️ {__('selectToolForSlot') || 'تخصيص الأداة للخانة'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Wave {waveIndex + 1} — {section === 'L' ? (__('leftFlank') || 'Left Flank') : section === 'R' ? (__('rightFlank') || 'Right Flank') : (__('centerFlank') || 'Center')} — Slot {slotIndex + 1}
                  </Typography>
                </Box>

                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'var(--brand)' }}>
                  {__('remainingCapacity') || 'السعة المتبقية'}: {remainingCapacity} / {maxAllowed}
                </Typography>
              </DialogTitle>

              <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.05)', py: 2.5 }}>
                {/* Search and Filters */}
                <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                  <TextField
                    placeholder={__('searchTools') || 'البحث عن أداة...'}
                    size="small"
                    value={toolSearchText}
                    onChange={(e) => setToolSearchText(e.target.value)}
                    sx={{
                      flexGrow: 1,
                      minWidth: '200px',
                      '& .MuiInputBase-root': {
                        height: '38px',
                        fontSize: '13px',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        color: '#fff',
                        '&:hover': {
                          borderColor: 'var(--brand)'
                        }
                      }
                    }}
                  />

                  <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                    {Object.entries(FILTER_LABELS_AR).map(([key, label]) => (
                      <Button
                        key={key}
                        size="small"
                        variant={selectedToolTypeFilter === key ? 'contained' : 'outlined'}
                        onClick={() => setSelectedToolTypeFilter(key)}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: '11.5px',
                          borderRadius: '20px',
                          px: 2,
                          height: '30px'
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </Box>
                </Box>

                {/* Tools Grid */}
                {loadingConfig ? (
                  <Typography sx={{ fontStyle: 'italic', py: 4, textAlign: 'center' }}>
                    Loading tools catalog...
                  </Typography>
                ) : (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))',
                      gap: 1.5,
                      maxHeight: '260px',
                      overflowY: 'auto',
                      p: 1,
                      background: 'rgba(0,0,0,0.15)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.03)'
                    }}
                  >
                    {filteredTools.map(t => {
                      // Since we already filter by event in filteredTools, no wrong-event tools shown
                      const isWrongEvent = false
                      // Gate tool on flank check
                      const isGateOnFlank = section !== 'M' && t.type === 'gate'

                      // Tool type limit check (max 2 for L/R flanks, max 3 for Center M)
                      const currentUniqueTypes = getWaveSectionUniqueTypes(wave, section, slotIndex)
                      const maxTypesAllowed = section === 'M' ? 3 : 2
                      const isTypeAlreadyUsed = wave[section]?.some((s, idx) => idx !== slotIndex && s && s.toolId === t.id)
                      const isTypeLimitExceeded = !isTypeAlreadyUsed && currentUniqueTypes >= maxTypesAllowed

                      const isDisabled = isWrongEvent || isGateOnFlank || isTypeLimitExceeded
                      const isSelected = dialogSelectedTool && dialogSelectedTool.id === t.id

                      const path = assetsMap[t.assetKey]
                      const imageUrl = path ? `/ggeProxyEmpire5/default/assets/${path}.webp` : null

                      const details = TOOL_DETAILS_AR[t.id] || { name: t.name, desc: '' }
                      let tooltipTitle = details.name + (details.desc ? ` - ${details.desc}` : '')
                      if (isWrongEvent) tooltipTitle += ` (${__('eventLocked') || 'مغلق لهذا الحدث'})`
                      else if (isGateOnFlank) tooltipTitle += ` (${__('noRamsOnFlanks') || 'لا يمكن وضع البوابات على الأجنحة'})`
                      else if (isTypeLimitExceeded) tooltipTitle += ` (${__('typeLimitExceeded') || `الحد الأقصى ${maxTypesAllowed} أنواع للقسم`})`

                      return (
                        <Box
                          key={t.id}
                          onClick={() => {
                            if (isDisabled) return
                            setDialogSelectedTool(t)
                          }}
                          sx={{
                            width: '68px',
                            height: '68px',
                            borderRadius: '10px',
                            border: isSelected
                              ? '2px solid var(--brand)'
                              : '1px solid rgba(255,255,255,0.06)',
                            background: isSelected
                              ? 'linear-gradient(135deg, rgba(0, 189, 166, 0.15) 0%, rgba(36,59,85,0.4) 100%)'
                              : 'linear-gradient(135deg, rgba(20,30,48,0.4) 0%, rgba(36,59,85,0.4) 100%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled ? 0.25 : 1,
                            filter: isDisabled ? 'grayscale(100%)' : 'none',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              transform: isDisabled ? 'none' : 'scale(1.06)',
                              borderColor: isDisabled ? 'rgba(255,255,255,0.06)' : 'var(--brand)',
                            }
                          }}
                          title={tooltipTitle}
                        >
                          {imageUrl ? (
                            <img
                              src={`/tools/${t.id}.webp`}
                              alt={t.name}
                              style={{ width: '46px', height: '46px', objectFit: 'contain' }}
                              onError={(e) => {
                                const targetSrc = e.target.src
                                if (imageUrl && !targetSrc.includes(imageUrl)) {
                                  e.target.src = imageUrl
                                } else {
                                  e.target.style.display = 'none'
                                }
                              }}
                            />
                          ) : (
                            <Typography variant="caption" sx={{ fontSize: '9px', textAlign: 'center', px: 0.5, wordBreak: 'break-all' }}>
                              {t.name}
                            </Typography>
                          )}
                        </Box>
                      )
                    })}

                    {filteredTools.length === 0 && (
                      <Box sx={{ gridColumn: '1 / -1', py: 4, textAlign: 'center', color: 'text.secondary' }}>
                        No tools found matching filters.
                      </Box>
                    )}
                  </Box>
                )}

                {/* Quantity and Selected Tool Details */}
                {dialogSelectedTool && (
                  <Box sx={{ mt: 3, p: 2, borderRadius: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'center' }}>
                      <Box>
                        <Typography sx={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--brand)' }}>
                          {TOOL_DETAILS_AR[dialogSelectedTool.id]?.name || dialogSelectedTool.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {TOOL_DETAILS_AR[dialogSelectedTool.id]?.desc || `تأثير الأداة: +${dialogSelectedTool.wallBonus || dialogSelectedTool.gateBonus || dialogSelectedTool.moatBonus || dialogSelectedTool.defRangeBonus}%`}
                        </Typography>

                        {/* Technical details badge for reference */}
                        <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', mt: 1.5 }}>
                          {dialogSelectedTool.wallBonus > 0 && <Chip label={`تقليل الجدار: -${dialogSelectedTool.wallBonus}%`} size="small" variant="outlined" color="primary" sx={{ fontSize: '10.5px', height: '22px', fontWeight: 600 }} />}
                          {dialogSelectedTool.gateBonus > 0 && <Chip label={`تقليل البوابة: -${dialogSelectedTool.gateBonus}%`} size="small" variant="outlined" color="primary" sx={{ fontSize: '10.5px', height: '22px', fontWeight: 600 }} />}
                          {dialogSelectedTool.moatBonus > 0 && <Chip label={`تقليل الخندق: -${dialogSelectedTool.moatBonus}%`} size="small" variant="outlined" color="primary" sx={{ fontSize: '10.5px', height: '22px', fontWeight: 600 }} />}
                          {dialogSelectedTool.defRangeBonus > 0 && <Chip label={`تقليل دفاع الرماة: -${dialogSelectedTool.defRangeBonus}%`} size="small" variant="outlined" color="primary" sx={{ fontSize: '10.5px', height: '22px', fontWeight: 600 }} />}
                          {dialogSelectedTool.samuraiTokenBooster > 0 && <Chip label={`عملات ساموراي: +${dialogSelectedTool.samuraiTokenBooster}%`} size="small" variant="outlined" color="secondary" sx={{ fontSize: '10.5px', height: '22px', fontWeight: 600 }} />}
                          {dialogSelectedTool.nomadTokenBooster > 0 && <Chip label={`لوحات بدو: +${dialogSelectedTool.nomadTokenBooster}%`} size="small" variant="outlined" color="secondary" sx={{ fontSize: '10.5px', height: '22px', fontWeight: 600 }} />}
                          {dialogSelectedTool.khanTabletBooster > 0 && <Chip label={`لوحات خان: +${dialogSelectedTool.khanTabletBooster}%`} size="small" variant="outlined" color="secondary" sx={{ fontSize: '10.5px', height: '22px', fontWeight: 600 }} />}
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {__('qty') || 'العدد'}:
                        </Typography>
                        <input
                          type="number"
                          min="1"
                          max={remainingCapacity + (dialogSelectedTool.id === toolId ? quantity : 0)}
                          value={dialogQuantity}
                          onChange={(e) => {
                            const val = Math.min(
                              remainingCapacity + (dialogSelectedTool.id === toolId ? quantity : 0),
                              Math.max(1, parseInt(e.target.value) || 1)
                            )
                            setDialogQuantity(val)
                          }}
                          style={{
                            width: '60px',
                            background: '#000',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '4px',
                            color: '#fff',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            padding: '4px'
                          }}
                        />
                      </Box>
                    </Box>

                    <Slider
                      value={dialogQuantity}
                      min={1}
                      max={Math.max(1, remainingCapacity + (dialogSelectedTool.id === toolId ? quantity : 0))}
                      step={1}
                      onChange={(_, val) => setDialogQuantity(val)}
                      sx={{ color: 'var(--brand)' }}
                    />
                  </Box>
                )}
              </DialogContent>

              <DialogActions sx={{ p: 2.5, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <Button
                  color="error"
                  onClick={() => handleApplyTool(null, 0)}
                  sx={{ mr: 'auto', fontWeight: 700 }}
                >
                  🗑️ {__('clearSlot') || 'إخلاء الخانة'}
                </Button>

                <Button
                  onClick={() => setEditingSlot(null)}
                  sx={{ color: 'text.secondary', fontWeight: 700 }}
                >
                  {__('cancel') || 'إلغاء'}
                </Button>

                <Button
                  variant="contained"
                  disabled={!dialogSelectedTool}
                  onClick={() => handleApplyTool(dialogSelectedTool.id, dialogQuantity)}
                  sx={{ fontWeight: 700 }}
                >
                  ✔️ {__('apply') || 'تطبيق'}
                </Button>
              </DialogActions>
            </>
          )
        })()}
      </Dialog>
    </Box>
  )
}
