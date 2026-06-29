import * as React from 'react'
import Checkbox from '@mui/material/Checkbox'
import TextField from '@mui/material/TextField'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import FormGroup from '@mui/material/FormGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { ErrorType, ActionType } from "../types.js"
import PluginsTable from './pluginsTable'
import settings from '../settings.json'

const serverDetailsMap = {
  'generic_country_international': { flag: '🌐', name: 'International' },
  'generic_country_de': { flag: '🇩🇪', name: 'Germany' },
  'generic_country_fr': { flag: '🇫🇷', name: 'France' },
  'generic_country_cz': { flag: '🇨🇿', name: 'Czech Republic' },
  'generic_country_pl': { flag: '🇵🇱', name: 'Poland' },
  'generic_language_pt': { flag: '🇵🇹', name: 'Portugal/Brazil' },
  'generic_country_es': { flag: '🇪🇸', name: 'Spain' },
  'generic_country_it': { flag: '🇮🇹', name: 'Italy' },
  'generic_country_tr': { flag: '🇹🇷', name: 'Turkey' },
  'generic_country_nl': { flag: '🇳🇱', name: 'Netherlands' },
  'generic_country_hu': { flag: '🇭🇺', name: 'Hungary' },
  'generic_language_skn': { flag: '🇸🇪', name: 'Scandinavia' },
  'generic_country_ru': { flag: '🇷🇺', name: 'Russia' },
  'generic_country_ro': { flag: '🇷🇴', name: 'Romania' },
  'generic_country_bg': { flag: '🇧🇬', name: 'Bulgaria' },
  'generic_country_sk': { flag: '🇸🇰', name: 'Slovakia' },
  'generic_country_gb': { flag: '🇬🇧', name: 'United Kingdom' },
  'generic_country_br': { flag: '🇧🇷', name: 'Brazil' },
  'generic_country_us': { flag: '🇺🇸', name: 'USA' },
  'generic_country_au': { flag: '🇦🇺', name: 'Australia' },
  'generic_country_kr': { flag: '🇰🇷', name: 'South Korea' },
  'generic_country_jp': { flag: '🇯🇵', name: 'Japan' },
  'generic_country_his': { flag: '🇪🇸', name: 'Hispanoamerica' },
  'generic_country_in': { flag: '🇮🇳', name: 'India' },
  'generic_country_cn': { flag: '🇨🇳', name: 'China' },
  'generic_country_gr': { flag: '🇬🇷', name: 'Greece' },
  'generic_country_lt': { flag: '🇱🇹', name: 'Lithuania' },
  'generic_country_sa': { flag: '🇸🇦', name: 'Saudi Arabia' },
  'generic_country_ae': { flag: '🇦🇪', name: 'UAE' },
  'generic_country_eg': { flag: '🇪🇬', name: 'Egypt' },
  'generic_country_arab': { flag: '🌐', name: 'Arabic' },
  'generic_country_asia': { flag: '🌐', name: 'Asia' },
  'generic_country_hant': { flag: '🇹🇼', name: 'Taiwan/HK' },
  'generic_country_world': { flag: '🌐', name: 'World' }
};

function formatServerName(locaId, instanceName) {
  if (!locaId) return `Server ${instanceName}`;
  const key = locaId.toLowerCase();
  const info = serverDetailsMap[key];
  if (info) {
    return `${info.flag} ${info.name} ${instanceName}`;
  }
  const cleanLoca = locaId.replace('generic_country_', '').replace('generic_language_', '').toUpperCase();
  return `🌐 Server ${cleanLoca} ${instanceName}`;
}

let instances = []
fetch(`${window.location.protocol === 'https:' ? "https" : "http"}://${window.location.hostname}:${settings.port ?? window.location.port}/1.xml`)
  .then(res => res.text())
  .then(text => {
    let servers = new DOMParser().parseFromString(text, "text/xml")
    let _instances = servers.getElementsByTagName("instance")
    for (var key in _instances) {
        let obj = _instances[key]
        if (obj && typeof obj === 'object') {
            let server, zone, instanceLocaId, instanceName
            for (var key2 in obj.childNodes) {
                let obj2 = obj.childNodes[key2]
                switch(obj2.nodeName) {
                    case "server": server = obj2.childNodes[0]?.nodeValue; break
                    case "zone": zone = obj2.childNodes[0]?.nodeValue; break
                    case "instanceLocaId": instanceLocaId = obj2.childNodes[0]?.nodeValue; break
                    case "instanceName": instanceName = obj2.childNodes[0]?.nodeValue; break
                }
            }
            if(instanceLocaId)
                instances.push({id: obj.getAttribute("value"),server,zone,instanceLocaId,instanceName})
        }
    }
  })
  .catch(err => console.error("Failed to parse servers xml in userSettings:", err))

function parseProxyString(str) {
    str = (str || '').trim()
    if (!str) return { host: '', port: null, user: '', pass: '' }
    
    if (str.includes('@')) {
        const parts = str.split('@')
        const authParts = parts[0].split(':')
        const hostParts = parts[1].split(':')
        return {
            host: hostParts[0] || '',
            port: hostParts[1] ? parseInt(hostParts[1], 10) : null,
            user: authParts[0] || '',
            pass: authParts[1] || ''
        }
    }
    
    const parts = str.split(':')
    if (parts.length >= 4) {
        return {
            host: parts[0] || '',
            port: parts[1] ? parseInt(parts[1], 10) : null,
            user: parts[2] || '',
            pass: parts.slice(3).join(':') || ''
        }
    } else {
        return {
            host: parts[0] || '',
            port: parts[1] ? parseInt(parts[1], 10) : null,
            user: '',
            pass: ''
        }
    }
}

function formatProxy(host, port, user, pass) {
    if (!host) return ''
    let str = `${host}`
    if (port) str += `:${port}`
    if (user && pass) {
        str += `:${user}:${pass}`
    }
    return str
}

export default function UserSettings({ __, selectedUser, channels, plugins, ws, closeBackdrop }) {
    selectedUser.name ??= ""
    selectedUser.plugins ??= {}
    const isNewUser = selectedUser.name === ""
    const [name, setName] = React.useState(selectedUser.name)
    const [pass, setPass] = React.useState("")
    const [server, setServer] = React.useState(selectedUser.server ?? (instances[0]?.id || ""))
    const [externalEvent, setExternalEvent] = React.useState(selectedUser.externalEvent)
    
    const [proxyEnabled, setProxyEnabled] = React.useState(selectedUser.proxyEnabled ?? false)
    const [proxyType, setProxyType] = React.useState(selectedUser.proxyType || "SOCKS5")
    const [proxyInput, setProxyInput] = React.useState(
        formatProxy(selectedUser.proxyHost, selectedUser.proxyPort, selectedUser.proxyUser, selectedUser.proxyPass)
    )
    const [testStatus, setTestStatus] = React.useState("")
    const [testErrorMessage, setTestErrorMessage] = React.useState("")

    const handleTestProxy = () => {
        const parsed = parseProxyString(proxyInput)
        if (!parsed.host || !parsed.port) {
            setTestStatus("error")
            setTestErrorMessage(__("proxyInvalidFormat") || "Invalid proxy format (ip:port)")
            return
        }

        setTestStatus("testing")
        setTestErrorMessage("")

        const onMessage = (msg) => {
            try {
                const [errVal, action, obj] = JSON.parse(msg.data.toString())
                if (action === ActionType.TestProxy) {
                    ws.removeEventListener("message", onMessage)
                    if (errVal === ErrorType.Success) {
                        setTestStatus("success")
                    } else {
                        setTestStatus("error")
                        setTestErrorMessage(obj.error || "Unknown error")
                    }
                }
            } catch (e) {
                console.error("Error parsing test proxy response:", e)
            }
        }

        ws.addEventListener("message", onMessage)

        ws.send(JSON.stringify([
            ErrorType.Success,
            ActionType.TestProxy,
            {
                proxyHost: parsed.host,
                proxyPort: parsed.port,
                proxyUser: parsed.user,
                proxyPass: parsed.pass,
                proxyType: proxyType
            }
        ]))

        // Safety timeout
        setTimeout(() => {
            ws.removeEventListener("message", onMessage)
        }, 10000)
    }

    return (
        <div onClick={event => event.stopPropagation()} style={{ width: '100%', maxWidth: '850px', display: 'flex', justifyContent: 'center', padding: '16px', boxSizing: 'border-box' }}>
            <Paper sx={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', width: "100%" }}>
                <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>
                    <FormGroup row={true} sx={{ mb: 2, gap: 2}}>
                        <TextField required size="small" label={__("username")} value={name} onChange={e => setName(e.target.value)} disabled={!isNewUser} />
                        <TextField required size="small" label={__("password")} type='password' value={pass} onChange={e => setPass(e.target.value)} />
                        
                        <FormControl size="small" style={{minWidth: "max-content"}}>
                            <InputLabel required id="simple-select-label">{__("server")}</InputLabel>
                            <Select
                                labelId="simple-select-label"
                                id="simple-select"
                                value={server}
                                onChange={(newValue) => setServer(newValue.target.value)}
                                disabled={!isNewUser}
                            >
                                {
                                    instances.map((server, i) => <MenuItem value={server.id} key={i}>{formatServerName(server.instanceLocaId, server.instanceName)}</MenuItem>)
                                }
                            </Select>
                        </FormControl>
                        <FormControlLabel sx={{ m: 0 }} control={<Checkbox size="small" />} checked={externalEvent} onChange={e => setExternalEvent(e.target.checked)} label={<Typography variant="body2">OR/BTH</Typography>} />
                    </FormGroup>

                    {/* Proxy Settings Section */}
                    <Box sx={{ my: 3, borderTop: '1px solid rgba(255,255,255,0.1)', pt: 2 }}>
                        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
                            {__("proxySettings") || "Proxy Settings"}
                        </Typography>
                        
                        {/* Proxy Warning Alert Banner */}
                        <Box sx={{
                            mb: 2,
                            p: 2,
                            borderRadius: 1,
                            bgcolor: 'rgba(255, 167, 38, 0.1)',
                            border: '1px solid rgba(255, 167, 38, 0.3)',
                            color: '#ffa726'
                        }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {__("proxyWarning") || "Note: Free proxies are completely fine as long as they are working."}
                            </Typography>
                        </Box>
                        
                        <FormGroup row={true} sx={{ mb: 2, gap: 2, alignItems: 'center' }}>
                            <FormControlLabel
                                sx={{ m: 0 }}
                                control={<Checkbox size="small" checked={proxyEnabled} onChange={e => setProxyEnabled(e.target.checked)} />}
                                label={<Typography variant="body2">{__("enableProxy") || "Enable Proxy"}</Typography>}
                            />
                            
                            <FormControl size="small" style={{ minWidth: 120 }} disabled={!proxyEnabled}>
                                <InputLabel id="proxy-type-label">{__("proxyType") || "Type"}</InputLabel>
                                <Select
                                    labelId="proxy-type-label"
                                    id="proxy-type-select"
                                    value={proxyType}
                                    label={__("proxyType") || "Type"}
                                    onChange={e => setProxyType(e.target.value)}
                                >
                                    <MenuItem value="HTTP">HTTP</MenuItem>
                                    <MenuItem value="HTTPS">HTTPS</MenuItem>
                                    <MenuItem value="SOCKS4">SOCKS4</MenuItem>
                                    <MenuItem value="SOCKS5">SOCKS5</MenuItem>
                                </Select>
                            </FormControl>
                            
                            <TextField
                                size="small"
                                label={__("proxyAddress") || "Proxy Address (ip:port:user:pass)"}
                                placeholder="12.34.56.78:8080 or 12.34.56.78:8080:user:pass"
                                value={proxyInput}
                                onChange={e => setProxyInput(e.target.value)}
                                disabled={!proxyEnabled}
                                sx={{ flexGrow: 1, minWidth: 300 }}
                            />
                            
                            <Button
                                variant="outlined"
                                size="medium"
                                onClick={handleTestProxy}
                                disabled={!proxyEnabled || testStatus === "testing"}
                            >
                                {testStatus === "testing" ? (__("testing") || "Testing...") : (__("testProxy") || "Test Proxy")}
                            </Button>
                        </FormGroup>
                        
                        {/* Test Status Messages */}
                        {testStatus === "success" && (
                            <Box sx={{ mb: 2, p: 1.5, borderRadius: 1, bgcolor: 'rgba(62, 207, 142, 0.1)', border: '1px solid rgba(62, 207, 142, 0.3)', color: '#3ecf8e' }}>
                                <Typography variant="body2">{__("proxyTestSuccess") || "Proxy connected successfully!"}</Typography>
                            </Box>
                        )}
                        {testStatus === "error" && (
                            <Box sx={{ mb: 2, p: 1.5, borderRadius: 1, bgcolor: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.3)', color: '#ff6b6b' }}>
                                <Typography variant="body2">
                                    {(__("proxyTestFailed") || "Proxy connection failed:")} {testErrorMessage}
                                </Typography>
                            </Box>
                        )}
                    </Box>

                    <PluginsTable plugins={plugins} userPlugins={selectedUser.plugins} channels={channels}  __={__} />
                </Box>
                
                <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', bgcolor: 'background.paper' }}>
                    <Button variant="contained" color="primary" size='small'
                        onClick={async () => {
                            for (const key in selectedUser.plugins) {
                                if(Object.keys(selectedUser.plugins[key]).length === 0)
                                    delete selectedUser.plugins[key]
                            }
                            const parsed = parseProxyString(proxyInput)
                            let obj = {
                                name: name,
                                pass: pass,
                                server: server,
                                plugins: selectedUser.plugins,
                                externalEvent: externalEvent,
                                state: selectedUser.state,
                                proxyHost: parsed.host,
                                proxyPort: parsed.port,
                                proxyUser: parsed.user,
                                proxyPass: parsed.pass,
                                proxyType: proxyType,
                                proxyEnabled: proxyEnabled
                            }
                            if (!isNewUser) {
                                obj.id = selectedUser.id
                                if (pass === "") obj.pass = selectedUser.pass
                            }

                            ws.send(JSON.stringify([
                                ErrorType.Success,
                                isNewUser ? ActionType.AddUser : ActionType.SetUser,
                                obj
                            ]))

                            closeBackdrop()
                        }}
                    >
                        {__("save")}
                    </Button>
                </Box>
            </Paper>
        </div>
    )
}