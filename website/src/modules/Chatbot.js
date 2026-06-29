import * as React from 'react'
import { ActionType, ErrorType } from '../types.js'

// ── Chatbot floating button + chat window ──────────────────────────────────
// Uses the existing ReconnectingWebSocket (ws prop) for all communication.
// Security: message length capped client-side before sending.
// ──────────────────────────────────────────────────────────────────────────

const MAX_CLIENT_MSG = 300   // chars — matches server cap
const MAX_HISTORY    = 80    // messages kept in memory

export default function Chatbot({ ws }) {
  const [open,    setOpen]    = React.useState(false)
  const [input,   setInput]   = React.useState('')
  const [history, setHistory] = React.useState([
    { from: 'bot', text: '👋 أهلاً! أنا مساعدك الذكي.\nاكتب **مساعدة** لشوف الأوامر المتاحة.' }
  ])
  const [loading, setLoading] = React.useState(false)

  const bottomRef  = React.useRef(null)
  const inputRef   = React.useRef(null)

  // ── Scroll to bottom whenever history changes ────────────────────────────
  React.useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, open])

  // ── Focus input when chat opens ──────────────────────────────────────────
  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // ── Listen for replies from the server ──────────────────────────────────
  React.useEffect(() => {
    if (!ws) return

    const onMessage = (event) => {
      let parsed
      try { parsed = JSON.parse(event.data.toString()) }
      catch { return }

      const [err, action, obj] = parsed
      if (Number(action) !== ActionType.ChatbotMessage) return

      setLoading(false)

      const text = (err === ErrorType.Success)
        ? (obj?.reply ?? '✅ تم!')
        : (obj?.reply ?? obj?.error ?? '⚠️ حصل خطأ.')

      setHistory(prev => [
        ...prev.slice(-MAX_HISTORY),
        { from: 'bot', text }
      ])
    }

    ws.addEventListener('message', onMessage)
    return () => ws.removeEventListener('message', onMessage)
  }, [ws])

  // ── Send a message ───────────────────────────────────────────────────────
  const sendMessage = () => {
    const text = input.trim().slice(0, MAX_CLIENT_MSG)
    if (!text || loading) return

    // Append user message to history
    setHistory(prev => [
      ...prev.slice(-MAX_HISTORY),
      { from: 'user', text }
    ])
    setInput('')
    setLoading(true)

    try {
      ws.send(JSON.stringify([ErrorType.Success, ActionType.ChatbotMessage, { message: text }]))
    } catch {
      setLoading(false)
      setHistory(prev => [...prev, { from: 'bot', text: '⚠️ تعذّر الإرسال — تحقق من الاتصال.' }])
    }
  }

  // ── Enter key sends ──────────────────────────────────────────────────────
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Render markdown-like bold (**text**) ─────────────────────────────────
  const renderText = (text) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part.split('\n').map((line, j, arr) =>
            j < arr.length - 1 ? <React.Fragment key={j}>{line}<br /></React.Fragment> : line
          )
    )

  // ────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Floating trigger button ── */}
      <button
        id="chatbot-trigger-btn"
        aria-label="Open chatbot assistant"
        onClick={() => setOpen(o => !o)}
        style={{
          position:     'fixed',
          bottom:       '24px',
          right:        '24px',
          width:        '58px',
          height:       '58px',
          borderRadius: '50%',
          border:       'none',
          cursor:       'pointer',
          padding:      0,
          zIndex:       9998,
          background:   'transparent',
          boxShadow:    open
            ? '0 0 0 3px #00bda6, 0 8px 32px rgba(0,189,166,0.45)'
            : '0 4px 20px rgba(0,0,0,0.35)',
          transition:   'box-shadow 0.25s ease, transform 0.2s ease',
          transform:    open ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        <img
          src="/icon.png"
          alt="AI assistant"
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        />
      </button>

      {/* ── Chat window ── */}
      {open && (
        <div
          id="chatbot-window"
          role="dialog"
          aria-label="Chatbot assistant"
          style={{
            position:      'fixed',
            bottom:        '94px',
            right:         '24px',
            width:         '340px',
            maxHeight:     '500px',
            borderRadius:  '18px',
            zIndex:        9999,
            display:       'flex',
            flexDirection: 'column',
            overflow:      'hidden',
            boxShadow:     '0 12px 48px rgba(0,0,0,0.45)',
            border:        '1px solid rgba(0,189,166,0.25)',
            background:    'linear-gradient(160deg, #13172a 0%, #0e1221 100%)',
            animation:     'chatbotSlideUp 0.22s ease',
          }}
        >
          {/* Header */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            gap:            '10px',
            padding:        '14px 16px',
            borderBottom:   '1px solid rgba(255,255,255,0.07)',
            background:     'rgba(0,189,166,0.08)',
          }}>
            <img
              src="/icon.png"
              alt=""
              style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px', lineHeight: 1.2 }}>
                المساعد الذكي
              </div>
              <div style={{ color: '#00bda6', fontSize: '11px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: '#00bda6', display: 'inline-block',
                  boxShadow: '0 0 6px #00bda6',
                }} />
                متصل
              </div>
            </div>
            <button
              aria-label="Close chatbot"
              onClick={() => setOpen(false)}
              style={{
                background: 'none', border: 'none', color: '#7a8aaa',
                cursor: 'pointer', fontSize: '18px', lineHeight: 1,
                padding: '2px 6px', borderRadius: '6px',
              }}
            >✕</button>
          </div>

          {/* Messages */}
          <div style={{
            flex:       1,
            overflowY:  'auto',
            padding:    '14px 12px',
            display:    'flex',
            flexDirection: 'column',
            gap:        '10px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0,189,166,0.3) transparent',
          }}>
            {history.map((msg, i) => (
              <div key={i} style={{
                display:       'flex',
                justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start',
              }}>
                {msg.from === 'bot' && (
                  <img
                    src="/icon.png"
                    alt=""
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      objectFit: 'cover', alignSelf: 'flex-end',
                      marginRight: 6, flexShrink: 0,
                    }}
                  />
                )}
                <div style={{
                  maxWidth:     '80%',
                  padding:      '9px 13px',
                  borderRadius: msg.from === 'user'
                    ? '16px 16px 4px 16px'
                    : '16px 16px 16px 4px',
                  background: msg.from === 'user'
                    ? 'linear-gradient(135deg, #00bda6, #0096a0)'
                    : 'rgba(255,255,255,0.06)',
                  color:       '#fff',
                  fontSize:    '13px',
                  lineHeight:  1.55,
                  wordBreak:   'break-word',
                  border: msg.from === 'bot'
                    ? '1px solid rgba(255,255,255,0.07)'
                    : 'none',
                }}>
                  {renderText(msg.text)}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <img
                  src="/icon.png"
                  alt=""
                  style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }}
                />
                <div style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '16px 16px 16px 4px',
                  padding: '10px 14px',
                  display: 'flex', gap: 5, alignItems: 'center',
                }}>
                  {[0, 1, 2].map(n => (
                    <span key={n} style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: '#00bda6',
                      animation: `chatbotDot 1.2s ease-in-out ${n * 0.2}s infinite`,
                      display: 'inline-block',
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding:      '10px 12px',
            borderTop:    '1px solid rgba(255,255,255,0.07)',
            display:      'flex',
            gap:          '8px',
            alignItems:   'center',
            background:   'rgba(0,0,0,0.15)',
          }}>
            <input
              ref={inputRef}
              id="chatbot-input"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value.slice(0, MAX_CLIENT_MSG))}
              onKeyDown={onKeyDown}
              disabled={loading}
              placeholder="اكتب رسالة..."
              maxLength={MAX_CLIENT_MSG}
              autoComplete="off"
              style={{
                flex:          1,
                background:    'rgba(255,255,255,0.07)',
                border:        '1px solid rgba(0,189,166,0.2)',
                borderRadius:  '12px',
                color:         '#fff',
                fontSize:      '13px',
                padding:       '9px 13px',
                outline:       'none',
                direction:     'rtl',
                transition:    'border-color 0.2s',
              }}
              onFocus={e  => e.target.style.borderColor = '#00bda6'}
              onBlur={e   => e.target.style.borderColor = 'rgba(0,189,166,0.2)'}
            />
            <button
              id="chatbot-send-btn"
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              style={{
                width:         '38px',
                height:        '38px',
                borderRadius:  '50%',
                border:        'none',
                cursor:        loading || !input.trim() ? 'default' : 'pointer',
                background:    loading || !input.trim()
                  ? 'rgba(255,255,255,0.1)'
                  : 'linear-gradient(135deg, #00bda6, #0096a0)',
                color:         '#fff',
                fontSize:      '16px',
                display:       'flex',
                alignItems:    'center',
                justifyContent:'center',
                flexShrink:    0,
                transition:    'background 0.2s, transform 0.1s',
                transform:     'rotate(-40deg)',
              }}
              onMouseDown={e => { if (!loading && input.trim()) e.currentTarget.style.transform = 'rotate(-40deg) scale(0.92)' }}
              onMouseUp={e   => { e.currentTarget.style.transform = 'rotate(-40deg) scale(1)' }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* ── Keyframe animations (injected once) ── */}
      <style>{`
        @keyframes chatbotSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes chatbotDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
        #chatbot-window *::-webkit-scrollbar { width: 4px; }
        #chatbot-window *::-webkit-scrollbar-thumb { background: rgba(0,189,166,0.35); border-radius: 4px; }
        #chatbot-trigger-btn:hover { transform: scale(1.1) !important; }
      `}</style>
    </>
  )
}
