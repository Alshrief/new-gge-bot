import * as React from 'react'
import { Box, Typography, FormControl, Select, MenuItem, InputLabel, Paper, Button, Checkbox, FormControlLabel } from '@mui/material'
import { ActionType, ErrorType, LogLevel } from '../types.js'
import TerminalIcon from '@mui/icons-material/Terminal'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'

export default function LiveLog({ ws, users, __ }) {
  const [selectedBotId, setSelectedBotId] = React.useState('all')
  const [logBuffer, setLogBuffer] = React.useState([])
  const [autoscroll, setAutoscroll] = React.useState(true)
  const terminalRef = React.useRef(null)



  // Subscribe to logs whenever selectedBotId changes
  React.useEffect(() => {
    if (selectedBotId === 'all') {
      // If 'all', we can clear logs or just subscribe to the first running bot
      setLogBuffer([])
      return
    }

    const botObj = users.find(b => b.id === Number(selectedBotId))
    if (botObj) {
      setLogBuffer([])
      // Subscribe to this bot's logs by sending GetLogs request
      if (ws.readyState === 1) {
        ws.send(JSON.stringify([
          ErrorType.Success,
          ActionType.GetLogs,
          botObj
        ]))
      }
    }
  }, [selectedBotId, users, ws])

  // Listen to incoming logs for the subscribed bot
  React.useEffect(() => {
    const handleLogsUpdate = (event) => {
      try {
        const [err, action, obj] = JSON.parse(event.data.toString())
        if (Number(action) === ActionType.GetLogs && Number(err) === ErrorType.Success) {
          if (obj && Array.isArray(obj[0])) {
            // obj[0] is the buffer of 25 logs: [[logLevel, messageArray], ...]
            // obj[1] is the current write index (messageBufferCount)
            const buffer = obj[0]
            const writeIdx = obj[1]
            
            // Reconstruct logs in chronological order
            const orderedLogs = []
            for (let i = 0; i < buffer.length; i++) {
              // start from writeIdx, wrap around
              const idx = (writeIdx + i) % buffer.length
              const logEntry = buffer[idx]
              if (logEntry && Array.isArray(logEntry)) {
                orderedLogs.push(logEntry)
              }
            }
            setLogBuffer(orderedLogs)
          }
        }
      } catch (e) {}
    }

    ws.addEventListener('message', handleLogsUpdate)
    return () => ws.removeEventListener('message', handleLogsUpdate)
  }, [ws])

  // Scroll to bottom
  React.useEffect(() => {
    if (autoscroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [logBuffer, autoscroll])

  const clearLogs = () => {
    setLogBuffer([])
  }

  const formatLogText = (msgArray) => {
    return msgArray.map(item => {
      if (typeof item === 'object') return JSON.stringify(item)
      return __(item) || item
    }).join('')
  }

  return (
    <Box sx={{ width: '100%', animation: 'fadeIn 0.5s ease' }}>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TerminalIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {__('liveLog') || 'السجل الحي للأجهزة'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="bot-select-label">{__('selectBotAccount') || 'اختر حساب اللعبة'}</InputLabel>
              <Select
                labelId="bot-select-label"
                value={selectedBotId}
                label={__('selectBotAccount') || 'اختر حساب اللعبة'}
                onChange={(e) => setSelectedBotId(e.target.value)}
              >
                <MenuItem value="all"><em>{__('chooseAccount') || '-- اختر حساباً --'}</em></MenuItem>
                {users.map((bot) => (
                  <MenuItem key={bot.id} value={bot.id}>
                    {bot.name} ({bot.state === 1 ? '🟢' : '🔴'})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={clearLogs}
            >
              {__('clearLogs') || 'مسح السجل'}
            </Button>
          </Box>
        </Box>

        {/* Terminal Screen */}
        <Box
          ref={terminalRef}
          sx={{
            background: '#07080d',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            p: 2.5,
            height: '450px',
            overflowY: 'auto',
            fontFamily: 'monospace, "Cairo"',
            fontSize: '13.5px',
            lineHeight: 1.8,
            boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.8)'
          }}
        >
          {logBuffer.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', mt: 10 }}>
              {selectedBotId === 'all' 
                ? (__('selectRunningBotToSeeLogs') || 'يرجى اختيار حساب لعبة نشط لبدء بث سجل التشغيل الحي.')
                : (__('waitingForLogs') || 'في انتظار وصول سجلات التشغيل من البوت...')}
            </Typography>
          ) : (
            logBuffer.map((log, idx) => {
              const logLevel = log[0] // 0: Info, 1: Warn, 2: Error
              const msgArray = log[1]
              
              let color = '#5ab4dc' // Default info blue
              let prefix = '[INFO] '
              if (logLevel === LogLevel.Warn || logLevel === 1) {
                color = '#f59e0b' // Yellow
                prefix = '[WARN] '
              } else if (logLevel === LogLevel.Error || logLevel === 2) {
                color = '#ef4444' // Red
                prefix = '[ERROR] '
              }

              return (
                <div key={idx} style={{ color, whiteSpace: 'pre-wrap', borderBottom: '1px solid rgba(255,255,255,0.01)', paddingBottom: '4px', marginBottom: '4px' }}>
                  <span style={{ opacity: 0.5, marginRight: '8px' }}>{prefix}</span>
                  {formatLogText(msgArray)}
                </div>
              )
            })
          )}
        </Box>

        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={autoscroll}
                onChange={(e) => setAutoscroll(e.target.checked)}
                color="primary"
              />
            }
            label={__('autoscroll') || 'النزول التلقائي للمستجدات'}
          />
        </Box>
      </Paper>
    </Box>
  )
}
