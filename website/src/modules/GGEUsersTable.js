import * as React from 'react'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Backdrop from '@mui/material/Backdrop'
import Checkbox from '@mui/material/Checkbox'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'

import { ErrorType, ActionType, LogLevel } from "../types.js"
import UserSettings from './userSettings'
import settings from '../settings.json'
import { Grid } from '@mui/material'
import ArmyAndTools from './ArmyAndTools'
import ProductionOverview from './ProductionOverview'

function Log({ ws, __ }) {
    const [currentLogs, setCurrentLogs] = React.useState([])

    React.useEffect(() => {
        const logGrabber = msg => {
            let [err, action, obj] = JSON.parse(msg.data.toString())

            if (Number(action) !== ActionType.GetLogs)
                return

            if (Number(err) !== ErrorType.Success)
                return

            setCurrentLogs(obj[0].splice(obj[1], obj[0].length - 1).concat(obj[0]).map((obj, index) => {
                let items = obj[1].map(__).join("")
                return <div key={index} style={{
                    color: obj[0] === LogLevel.Error ? "red" :
                        obj[0] === LogLevel.Warn ? "yellow" : "blue"
                }}>{items}</div>
            }
            ).reverse())
        }
        ws.addEventListener("message", logGrabber)
        return () => ws.removeEventListener("message", logGrabber)

    }, [ws, __])

    return (
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '800px', padding: '16px', boxSizing: 'border-box' }}>
            <Paper sx={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'auto', width: '100%', p: 2 }}>
                <Typography variant="subtitle1" component="div" align='left' padding={"10px"}>
                    {currentLogs}
                </Typography>
            </Paper>
        </div>
    )
}
function Language({ languageCode, setLanguage }) {
    const [anchorEl, setAnchorEl] = React.useState(null)
    const open = Boolean(anchorEl)
    const handleClick = event => { setAnchorEl(event.currentTarget) }
    const handleClose = () => { setAnchorEl(null) }

    return (
        <>
            <Button
                id="basic-button"
                aria-controls={open ? 'basic-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={handleClick}
            >
                {languageCode}
            </Button>
            <Menu
                id="basic-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                slotProps={{
                    list: {
                        'aria-labelledby': 'basic-button',
                    },
                }}
            >
                <MenuItem onClick={() => { setLanguage('en'); handleClose() }}>EN</MenuItem>
                <MenuItem onClick={() => { setLanguage('pl'); handleClose() }}>PL</MenuItem>
                <MenuItem onClick={() => { setLanguage('de'); handleClose() }}>DE</MenuItem>
                <MenuItem onClick={() => { setLanguage('tr'); handleClose() }}>TR</MenuItem>
                <MenuItem onClick={() => { setLanguage('ar'); handleClose() }}>AR</MenuItem>
                <MenuItem onClick={() => { setLanguage('cs'); handleClose() }}>CS</MenuItem>
            </Menu>
        </>
    )
}

let assetsCache = null

function Resources({ __, openResources: rawResources, languageCode }) {
    const [assets, setAssets] = React.useState(assetsCache || {})

    React.useEffect(() => {
        if (!assetsCache) {
            fetch('/assets.json')
              .then(res => res.json())
              .then(json => {
                assetsCache = json
                setAssets(json)
              })
              .catch(err => console.error("Failed to fetch assets.json in GGEUsersTable:", err))
        }
    }, [])

    if(!rawResources)
        return <></>
    
    const resources = { ...rawResources }
    delete resources["coins"]
    delete resources["rubies"]

    const nameOverrides = {
        screws: "component1",
        blackPowder: "component2",
        saws: "component3",
        drills: "component4",
        crowbars: "component5",
        leatherStrips: "component6",
        chains: "component7",
        metalPlates: "component8",
    }
    for (const key in nameOverrides) {
        const value = resources[key]
        if(value) {
            resources[nameOverrides[key]] = value
            delete resources[key]
        }
    }
    for (const key in resources) {
        if([undefined, 0, null].includes(resources[key])) {
            delete resources[key]
            continue
        }
        if (Number(resources[key])) {
            const skipOverrides = {
                "1MinSkip": 1,
                "5MinSkip": 5,
                "10MinSkip": 10,
                "30MinSkip": 30,
                "60MinSkip": 1,
                "5HourSkip": 5,
                "24HourSkip": 24,
            }
            const value = skipOverrides[key]
            resources[key] = `${value? `${value}x` : ""}${new Intl.NumberFormat(languageCode, { notation: 'compact' }).format(resources[key])}`
        }
    }
    const capitalizeFirstLetter = o =>
         String(o).charAt(0).toLocaleUpperCase() + String(o).slice(1)
    
    return (
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '800px', padding: '16px', boxSizing: 'border-box' }}>
            <Paper sx={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'auto', width: '100%', p: 3 }}>
                <Typography variant="h6" sx={{ mb: 3, fontWeight: 700, fontFamily: "'Cairo', 'Outfit', sans-serif", color: 'var(--text-primary)' }}>
                    {__("resources") || "Resources"}
                </Typography>
                <Grid container spacing={2}>
                    {
                        Object.entries(resources).map(([key, value], i) => {
                            const jsonKey = capitalizeFirstLetter(key)
                            return (
                                <Grid item xs={6} sm={4} md={3} key={i}>
                                    <div style={{ 
                                        justifyContent: "center", 
                                        display: "flex", 
                                        flexDirection:"column",  
                                        alignItems:"center",
                                        backgroundColor: "rgba(255, 255, 255, 0.02)",
                                        border: "1px solid var(--border-light)",
                                        borderRadius: "14px",
                                        padding: "16px"
                                    }}>
                                        <div style={{ height: "32px", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <img alt={__(key)} onError={(e) => {
                                                e.currentTarget.outerHTML = `<div style="overflow:hidden;max-height:100%;max-width:100%;font-size:11px;color:var(--text-muted)">${__(key)}</div>`
                                            }} style={{ maxHeight: "100%", maxWidth: "100%"}} src={`/ggeProxyEmpire5/default/assets/${assets[`Collectable_Currency_${jsonKey}`]}.webp`}></img>
                                        </div>
                                        <Typography variant="subtitle1" component="div" align='center' sx={{ fontWeight: 600, mt: 1.5, color: 'var(--text-primary)' }}>
                                            {value}
                                        </Typography>
                                    </div>
                                </Grid>
                            )
                        })
                    }
                </Grid>
            </Paper>
        </div>
    )
}
function PlayerTable({ setLanguage, __, languageCode, rows, usersStatus, ws, channelInfo, handleSettingsOpen, handleLogOpen, setSelectedUser, setOpenSettings, handleResourcesOpen, handleMilitaryOpen, handleProductionOpen, plugins, profile }) {
    const [selected, setSelected] = React.useState([])
    const handleSelectAllClick = event => {
        if (event.target.checked) {
            const newSelected = rows.map(n => n.id)
            setSelected(newSelected)
            return
        }
        setSelected([])
    }

    return (
        <Box sx={{ width: '100%' }}>
            <Box 
                sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    mb: 3,
                    flexWrap: 'wrap',
                    gap: 2
                }}
            >
                <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: "'Cairo', 'Outfit', sans-serif", color: 'var(--text-primary)' }}>
                    {__("botInstances") || "Bot Accounts"}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Language setLanguage={setLanguage} languageCode={languageCode} />
                    <Button
                        variant="outlined"
                        onClick={async () =>
                            window.open(`https://discord.com/oauth2/authorize?client_id=${channelInfo[0]}&permissions=8&response_type=code&redirect_uri=${window.location.protocol === 'https:' ? "https" : "http"}%3A%2F%2F${window.location.hostname}%3A${(settings.port ?? window.location.port) !== '' ? (settings.port ?? window.location.port) : window.location.protocol === 'https:' ? "443" : "80"}%2FdiscordAuth&integration_type=0&scope=identify+guilds.join+bot`, "_blank")}
                    >
                        {__("linkDiscord")}
                    </Button>
                    <Button 
                        variant="contained" 
                        onClick={handleSettingsOpen}
                        sx={{ px: 3 }}
                    >
                        + {__("addGameAccount")}
                    </Button>
                </Box>
            </Box>

            <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }} aria-label="simple table">
                    <TableHead>
                        <TableRow>
                            {profile?.privilege === 1 && (
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        color="primary"
                                        checked={rows.length > 0 && rows.length === selected.length}
                                        onClick={handleSelectAllClick}
                                        inputProps={{
                                            'aria-label': 'select all entries',
                                        }}
                                    />
                                </TableCell>
                            )}
                            <TableCell align="left">{__("name")}</TableCell>
                            <TableCell align="left" padding='none'>{__("plugins")}</TableCell>
                            <TableCell>{__("status")}</TableCell>
                            <TableCell align="right">{__("actions") || "Actions"}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((row, index) => {
                            function PlayerRow() {
                                let getEnabledPlugins = () => {
                                    const availablePluginKeys = new Set((plugins || []).map(plugin => plugin.key))
                                    let enabledPlugins = []
                                    Object.entries(row.plugins).forEach(([key, value]) => {
                                        if (availablePluginKeys.has(key) && Boolean(value.state) === true && Boolean(value.forced) !== true)
                                            enabledPlugins.push(key)
                                        return
                                    })
                                    return enabledPlugins
                                }

                                const isItemSelected = selected.includes(row.id)
                                const labelId = `enhanced-table-checkbox-${index}`
                                const [state, setState] = React.useState(row.state)
                                row.state = state
                                const [extEvent, setExtEvent] = React.useState(row.externalEvent ?? false)
                                row.externalEvent = extEvent

                                React.useEffect(() => {
                                    setState(row.state)
                                }, [row.state])

                                React.useEffect(() => {
                                    setExtEvent(row.externalEvent ?? false)
                                }, [row.externalEvent])

                                let status = usersStatus[row.id] ?? {}

                                return (
                                    <TableRow 
                                        style={status?.hasError ? { border: "red solid 2px" } : {}}
                                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                    >
                                        {profile?.privilege === 1 && (
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    color="primary"
                                                    checked={isItemSelected}
                                                    onClick={() => {
                                                        let index = selected.indexOf(row.id)
                                                        if (index < 0) {
                                                            selected.push(row.id)
                                                            setSelected(Array.from(selected))
                                                            return
                                                        }
                                                        setSelected(selected.toSpliced(index, 1))
                                                    }}
                                                    inputProps={{
                                                        'aria-labelledby': labelId,
                                                    }}
                                                />
                                            </TableCell>
                                        )}
                                        <TableCell component="th" scope="row">{row.name}</TableCell>

                                        <TableCell align="left" padding='none' sx={{ maxWidth: "25vw" }}>
                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 0.5 }}>
                                                {getEnabledPlugins().length > 0 ? (
                                                    getEnabledPlugins().map((pluginKey, i) => (
                                                        <Chip 
                                                            key={i} 
                                                            label={__(pluginKey)} 
                                                            size="small" 
                                                            variant="outlined" 
                                                            sx={{ 
                                                                fontSize: '11px',
                                                                borderColor: 'rgba(255, 255, 255, 0.15)',
                                                                color: 'var(--text-secondary)'
                                                            }} 
                                                        />
                                                    ))
                                                ) : (
                                                    <Typography variant="body2" sx={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                                                        {__("noActivePlugins")}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                {Object.entries(status).map(([key, value], index) => {
                                                    if (['id', 'hasError'].includes(key)) return null
                                                    if (value <= 0 || value === undefined || value === null) return null
                                                    
                                                    return (
                                                        <Box key={index} sx={{ display: 'flex', flexDirection: "column", alignItems: "center" }}>
                                                            <Typography sx={{ color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                {__(key)}
                                                            </Typography>
                                                            <Typography sx={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                                                                {key === "attackDailyCount" ? value : new Intl.NumberFormat(languageCode, { notation: 'compact' }).format(value)}
                                                            </Typography>
                                                        </Box>
                                                    )
                                                })}
                                            </Box>
                                        </TableCell>
                                        <TableCell align="right" padding='none' style={{ padding: "10px" }}>
                                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'nowrap' }}>
                                                <Button size="small" variant="text" onClick={() => handleResourcesOpen(status)}>{__("resources")}</Button>
                                                <Button size="small" variant="text" disabled={!status.military} onClick={() => handleMilitaryOpen(status)}>{__("armyAndTools")}</Button>
                                                <Button size="small" variant="text" disabled={!status.production} onClick={() => handleProductionOpen(status)}>{__("production")}</Button>
                                                <Button size="small" variant="text" onClick={() => {
                                                    ws.send(JSON.stringify([ErrorType.Success, ActionType.GetLogs, row]))
                                                    handleLogOpen()
                                                }}>{__("logs")}</Button>
                                                <Button size="small" variant="text" onClick={() => {
                                                    setSelectedUser(row)
                                                    setOpenSettings(true)
                                                }}>{__("settings")}</Button>
                                                <FormControlLabel
                                                    control={<Checkbox size="small" checked={extEvent} onChange={(e) => {
                                                        const newValue = e.target.checked
                                                        row.externalEvent = newValue
                                                        ws.send(JSON.stringify([ErrorType.Success, ActionType.SetUser, row]))
                                                        setExtEvent(newValue)
                                                    }} />}
                                                    label={<Typography variant="body2" sx={{ fontSize: '12px' }}>OR/BTH</Typography>}
                                                    sx={{ m: 0, mr: 1 }}
                                                />
                                                <Button
                                                    size="small"
                                                    onClick={() => {
                                                        row.state = !state
                                                        ws.send(JSON.stringify([ErrorType.Success, ActionType.SetUser, row]))
                                                        setState(!state)
                                                    }}
                                                    variant={state ? "contained" : "outlined"}
                                                    color={state ? "error" : "success"}
                                                    sx={{ px: 2.5, minWidth: '80px' }}
                                                >
                                                    {state ? __("stop") : __("start")}
                                                </Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                )
                            }
                            return <PlayerRow key={row.id} />
                        })}
                        {profile?.privilege === 1 && (
                            <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                <TableCell colSpan={5} align="right" padding='none' style={{ padding: "10px" }}>
                                    <Button 
                                        variant="outlined" 
                                        color="error"
                                        disabled={selected.length === 0}
                                        onClick={() => {
                                            ws.send(JSON.stringify([ErrorType.Success, ActionType.RemoveUser, rows.filter((e) => selected.includes(e.id))]))
                                            setSelected([])
                                        }}
                                        sx={{ px: 3 }}
                                    >
                                        {__("remove")} {selected.length > 0 ? `(${selected.length})` : ''}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    )
}
export default function GGEUserTable({ setLanguage, __, languageCode, rows, usersStatus, ws, channelInfo, plugins, profile }) {
    const user = {}

    const [openSettings, setOpenSettings] = React.useState(false)
    const [selectedUser, setSelectedUser] = React.useState(user)
    const [openLogs, setOpenLogs] = React.useState(false)
    const [openResources, setOpenResources] = React.useState(false)
    const [openMilitary, setOpenMilitary] = React.useState(false)

    const handleSettingsOpen = () => setOpenSettings(true)
    const handleSettingsClose = () => {
        setOpenSettings(false)
        setSelectedUser(user)
    }
    const handleLogClose = () => setOpenLogs(false)
    const handleLogOpen = () => setOpenLogs(true)
    const handleResourcesClose = () => setOpenResources(false)
    const handleResourcesOpen = (status) => setOpenResources(status.resources)
    const handleMilitaryClose = () => setOpenMilitary(false)
    const handleMilitaryOpen = (status) => setOpenMilitary(status.military)
    const [openProduction, setOpenProduction] = React.useState(false)
    const handleProductionClose = () => setOpenProduction(false)
    const handleProductionOpen = (status) => setOpenProduction(status.production)
    return (
        <>
            <Backdrop
                sx={theme => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
                open={openSettings}
                onClick={handleSettingsClose}
                style={{ maxHeight: '100%', overflow: 'auto' }}
                key={selectedUser.id} >
                <UserSettings ws={ws}
                    selectedUser={selectedUser}
                    key={selectedUser.id}
                    closeBackdrop={handleSettingsClose}
                    plugins={plugins}
                    channels={channelInfo[1]}
                    __={__} />
            </Backdrop>
            <Backdrop
                sx={theme => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
                open={openLogs}
                onClick={() => {
                    ws.send(JSON.stringify([ErrorType.Success, ActionType.GetLogs, undefined]))

                    handleLogClose()
                }}
                style={{ maxHeight: '100%', overflow: 'auto' }} >
                <Log ws={ws} __={__} />
            </Backdrop>
            <Backdrop
                sx={theme => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
                open={openResources !== false}
                onClick={() => {
                    handleResourcesClose()
                }}
                style={{ maxHeight: '100%', overflow: 'auto' }} >
                <Resources usersStatus={usersStatus} __={__}  openResources={openResources} languageCode={languageCode}/>
            </Backdrop>
            <Backdrop
                sx={theme => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
                open={openMilitary !== false}
                onClick={() => {
                    handleMilitaryClose()
                }}
                style={{ maxHeight: '100%', overflow: 'auto' }} >
                <ArmyAndTools __={__} openMilitary={openMilitary} languageCode={languageCode}/>
            </Backdrop>
            <Backdrop
                sx={theme => ({ color: '#fff', zIndex: theme.zIndex.drawer + 1 })}
                open={openProduction !== false}
                onClick={() => {
                    handleProductionClose()
                }}
                style={{ maxHeight: '100%', overflow: 'auto' }} >
                <ProductionOverview __={__} openProduction={openProduction} languageCode={languageCode}/>
            </Backdrop>
            <PlayerTable
                setLanguage={setLanguage}
                __={__}
                languageCode={languageCode}
                rows={rows}
                usersStatus={usersStatus}
                ws={ws}
                channelInfo={channelInfo}
                handleSettingsOpen={handleSettingsOpen}
                handleLogOpen={handleLogOpen}
                handleResourcesOpen={handleResourcesOpen}
                handleMilitaryOpen={handleMilitaryOpen}
                handleProductionOpen={handleProductionOpen}
                setSelectedUser={setSelectedUser}
                setOpenSettings={setOpenSettings}
                plugins={plugins}
                profile={profile}
            />
        </>
    )
}
