import * as React from 'react'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Select from '@mui/material/Select'
import Box from '@mui/material/Box'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import TextField from '@mui/material/TextField'
import FormControlLabel from '@mui/material/FormControlLabel'
import Slider from '@mui/material/Slider'
import Typography from '@mui/material/Typography'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { TimePicker } from '@mui/x-date-pickers/TimePicker'
import dayjs from 'dayjs'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import FlashOnIcon from '@mui/icons-material/FlashOn'
import StorefrontIcon from '@mui/icons-material/Storefront'
import SecurityIcon from '@mui/icons-material/Security'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import ExtensionIcon from '@mui/icons-material/Extension'

function PluginOption({ pluginData, channels, userPlugins, plugin, __ }) {
    userPlugins[plugin.key] ??= {}
    const [value, setValue] = React.useState(userPlugins[plugin.key][pluginData.key] ?? pluginData.default)

    const onChange = value => {
        userPlugins[plugin.key][pluginData.key] = value
        setValue(value)
    }
    switch (pluginData.type) {
        case "":
            return <></>
        case "Label":
            return <Typography variant="subtitle2" sx={{ width: '100%', borderBottom: '1px solid var(--border-light)', pb: 0.5, mb: 0.5, mt: 0.5, fontWeight: 'bold' }}>{__(pluginData.key)}</Typography>
        case "Text":
            const descKey = `${pluginData.key}_desc`
            const hasDesc = __(descKey) !== descKey
            return <TextField
                fullWidth
                label={__(pluginData.key)}
                variant="outlined"
                size="small"
                value={value || ""}
                onChange={e => onChange(e.target.value)}
                placeholder={pluginData.placeholder ? __(pluginData.placeholder) : ""}
                helperText={hasDesc ? __(descKey) : ""}
                FormHelperTextProps={{ sx: { fontSize: '0.75rem', mt: 0.25, color: 'var(--text-secondary)' } }}
                sx={{ my: 0.5, '& .MuiInputBase-root': { fontSize: '0.85rem' }, '& .MuiInputLabel-root': { fontSize: '0.85rem' } }}
            />
        case "Checkbox":
            return <FormControlLabel
                control={<Checkbox sx={{ p: 0.5 }} size="small" />}
                label={<Typography variant="body2">{pluginData.hideText ? "" : __(pluginData.key)}</Typography>}
                checked={Boolean(value)}
                onChange={(_, newValue) => onChange(newValue)}
                sx={{ mr: 1, ml: 0 }}
            />
        case "Table":
            const array_chunks = (array, chunk_size) => Array(Math.ceil(array.length / chunk_size)).fill().map((_, index) => index * chunk_size).map(begin => array.slice(begin, begin + chunk_size))
            return <TableContainer component={Paper} elevation={0} sx={{ mt: 0.5, mb: 1, background: 'transparent' }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            {pluginData.row.map((cRow, i) =>
                                <TableCell key={i} sx={{ fontWeight: 'bold', fontSize: '0.8rem' }}>{cRow}</TableCell>
                            )}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {
                            array_chunks(pluginData.data, pluginData.row.length).map((e, i) =>
                                <TableRow key={i}>
                                    {
                                        e.map((pluginData, j) => <TableCell key={j} sx={{ py: 0.5 }}>
                                            <PluginOption
                                                pluginData={pluginData}
                                                channels={channels}
                                                userPlugins={userPlugins[plugin.key] ??= {}}
                                                __={__}
                                                plugin={{ key: i }} />
                                        </TableCell>)
                                    }
                                </TableRow>)
                        }
                    </TableBody>
                </Table>
            </TableContainer>
        case "Channel":
            return <TextField
                fullWidth
                label={__(pluginData.key)}
                variant="outlined"
                size="small"
                value={value || ""}
                onChange={e => onChange(e.target.value)}
                placeholder="Discord Channel ID"
                sx={{ my: 0.5, '& .MuiInputBase-root': { fontSize: '0.85rem' }, '& .MuiInputLabel-root': { fontSize: '0.85rem' } }}
            />
        case "Select":
            return <FormControl fullWidth size="small" sx={{ my: 0.5 }}>
                <InputLabel sx={{ fontSize: '0.85rem' }}>{__(pluginData.key)}</InputLabel>
                <Select value={value} label={pluginData.key} onChange={(newValue) => onChange(newValue.target.value)} sx={{ fontSize: '0.85rem' }}>
                    {pluginData.selection.map((e, i) => <MenuItem value={i} key={i}>{__(e)}</MenuItem>)}
                </Select>
            </FormControl>
        case "Slider":
            return <Box sx={{ display: "flex", alignItems: "center", width: '100%', my: 0.5 }}>
                <Typography variant="body2" sx={{ mr: 1 }}>{__(pluginData.key)}</Typography>
                <Slider size="small" sx={{ flexGrow: 1 }} value={value} onChange={(_, newValue) => onChange(newValue)} />
                <Typography variant="body2" sx={{ ml: 1, minWidth: '35px' }}>{`${value}%`}</Typography>
            </Box>
        case "Time":
            return <LocalizationProvider dateAdapter={AdapterDayjs}>
                <Box sx={{ my: 0.5 }}>
                    <TimePicker
                        label={__(pluginData.key)}
                        value={dayjs(value) ?? dayjs()}
                        onChange={onChange}
                        slotProps={{ textField: { size: 'small', sx: { '& .MuiInputBase-root': { fontSize: '0.85rem' }, '& .MuiInputLabel-root': { fontSize: '0.85rem' } } } }}
                    />
                </Box>
            </LocalizationProvider>
        default:
            return null
    }
}

const PluginOptionContainer = ({ plugin, channels, userPlugins, __ }) => {
    const renderedKeys = new Set();
    return (
        <Box className="plugin-panel" sx={{ margin: 1, padding: 1.5 }}>
            <Typography className="plugin-panel-title" variant="subtitle1">{__(plugin.key)} {__("settings")}</Typography>
            {plugin?.pluginOptions?.map((pluginData, index) => {
                if (renderedKeys.has(pluginData.key)) return null;

                // Check if this is an X coordinate field that has a matching Y coordinate field
                if (pluginData.key.endsWith("X")) {
                    const baseKey = pluginData.key.slice(0, -1);
                    const yKey = `${baseKey}Y`;
                    const yOption = plugin.pluginOptions.find(o => o.key === yKey);
                    if (yOption) {
                        renderedKeys.add(pluginData.key);
                        renderedKeys.add(yKey);
                        return (
                            <Box key={`${plugin.key} ${index}`} sx={{ display: 'flex', gap: 2, my: 0.5 }}>
                                <Box sx={{ flex: 1 }}>
                                    <PluginOption pluginData={pluginData} channels={channels} userPlugins={userPlugins} __={__} plugin={plugin} />
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <PluginOption pluginData={yOption} channels={channels} userPlugins={userPlugins} __={__} plugin={plugin} />
                                </Box>
                            </Box>
                        );
                    }
                }

                renderedKeys.add(pluginData.key);
                return <PluginOption pluginData={pluginData} key={`${plugin.key} ${index}`} channels={channels} userPlugins={userPlugins} __={__} plugin={plugin} />
            })}
        </Box>
    )
}

function Plugin({ plugin, __, userPlugins, channels }) {
    userPlugins[plugin.key] ??= {}
    const [state, setState] = React.useState(userPlugins[plugin.key].state)
    const [open, setOpen] = React.useState(false)
    const hasOptions = plugin.pluginOptions?.length > 0

    return (
        <React.Fragment>
            <TableRow sx={{ '& > *': { borderBottom: 'unset' }, backgroundColor: open ? 'var(--bg-card-hover)' : 'inherit' }}>
                <TableCell sx={{ padding: '8px 16px', width: '40px' }}>
                    {hasOptions && (
                        <IconButton
                            aria-label="expand row"
                            size="small"
                            onClick={() => setOpen(!open)}
                        >
                            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                    )}
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', fontSize: '0.95rem', cursor: hasOptions ? 'pointer' : 'default', padding: '8px 16px' }} onClick={() => hasOptions && setOpen(!open)}>
                    {__(plugin.key)}
                </TableCell>
                <TableCell align='right' sx={{ padding: '8px 16px' }}>
                    {!plugin.force ?
                        <Button
                            variant={state ? "contained" : "outlined"}
                            color={state ? "error" : "inherit"}
                            size="small"
                            sx={{ minWidth: '70px', height: '28px', fontSize: '0.8rem' }}
                            onClick={() => {
                                setState(!state)
                                userPlugins[plugin.key].state = !state
                            }}>
                            {__(state ? "stop" : "start")}
                        </Button> : <Button size="small" sx={{ minWidth: '70px', height: '28px', fontSize: '0.8rem' }} disabled>{__("start")}</Button>
                    }
                </TableCell>
            </TableRow>
            <TableRow>
                <TableCell style={{ paddingBottom: 0, paddingTop: 0, border: 'none' }} colSpan={6}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <PluginOptionContainer userPlugins={userPlugins} channels={channels} __={__} plugin={plugin} />
                    </Collapse>
                </TableCell>
            </TableRow>
        </React.Fragment>
    )
}

const CATEGORY_MAP = {
    // Attacks & Events
    attackBarons: 'attacks',
    attackFortresses: 'attacks',
    attackSamurai: 'attacks',
    attackNomads: 'attacks',
    attackKhan: 'attacks',
    attackBerimondInvasion: 'attacks',
    attackBerimondKingdom: 'attacks',
    attackForeign: 'attacks',
    attackBloodcrows: 'attacks',
    attackDaimyo: 'attacks',
    resourceSendStorm: 'attacks',

    // Economy & Support
    nomadShop: 'economy',
    samuraiShop: 'economy',
    spendAffluence: 'economy',
    feast: 'economy',
    barracks: 'economy',
    hospital: 'economy',
    buildings: 'economy',
    toolsmith: 'economy',
    blacksmith: 'economy',
    blacksmithOR: 'economy',
    sellStoredEquipment: 'economy',
    resourceSend: 'economy',
    produceTools: 'economy',

    // Defense & Utils
    khanDefence: 'defense',
    stationOnHit: 'defense',
    helpRequests: 'defense',
    buyTools: 'defense',
    buySpeedGlobalEffect: 'defense',
    externalEventHelper: 'defense',
    shutoffTimer: 'defense',

    // Alerts & Discord
    aquaIsland: 'discord',
    aquaTower: 'discord',
    fortress: 'discord',
    chat: 'discord',
    outgoingAttacks: 'discord',
    incomingAttacks: 'discord',
    grandTornament: 'discord'
}

export default function PluginsTable({ __, userPlugins, plugins, channels }) {
    const [tab, setTab] = React.useState('attacks')

    // Filter plugins by tab
    const filteredPlugins = React.useMemo(() => {
        return plugins.filter(plugin => {
            const cat = CATEGORY_MAP[plugin.key] || 'other'
            return cat === tab
        })
    }, [plugins, tab])

    const handleTabChange = (event, newTab) => {
        setTab(newTab)
    }

    return (
        <Paper elevation={0} sx={{
            background: 'rgba(255, 255, 255, 0.01)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            p: 2,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            mb: 2
        }}>
            <Tabs
                value={tab}
                onChange={handleTabChange}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    '& .MuiTabs-indicator': {
                        backgroundColor: 'var(--brand)',
                        height: '3px',
                        borderRadius: '3px 3px 0 0'
                    },
                    '& .MuiTab-root': {
                        color: 'var(--text-secondary)',
                        minHeight: '48px',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        textTransform: 'none',
                        transition: 'all 0.2s ease',
                        display: 'inline-flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: '6px',
                        px: 2,
                        '&.Mui-selected': {
                            color: 'var(--brand)'
                        },
                        '&:hover': {
                            color: '#fff',
                            background: 'rgba(255,255,255,0.02)'
                        }
                    }
                }}
            >
                <Tab
                    value="attacks"
                    icon={<FlashOnIcon sx={{ fontSize: '1.1rem' }} />}
                    label={__("attacksEvents")}
                />
                <Tab
                    value="economy"
                    icon={<StorefrontIcon sx={{ fontSize: '1.1rem' }} />}
                    label={__("economySupport")}
                />
                <Tab
                    value="defense"
                    icon={<SecurityIcon sx={{ fontSize: '1.1rem' }} />}
                    label={__("defenseUtils")}
                />
                <Tab
                    value="discord"
                    icon={<NotificationsActiveIcon sx={{ fontSize: '1.1rem' }} />}
                    label={__("alertsDiscord")}
                />
                {plugins.some(p => !CATEGORY_MAP[p.key]) && (
                    <Tab
                        value="other"
                        icon={<ExtensionIcon sx={{ fontSize: '1.1rem' }} />}
                        label={__("otherPlugins")}
                    />
                )}
            </Tabs>

            <TableContainer>
                <Table aria-label="plugins table" size="small">
                    <TableBody>
                        {filteredPlugins.length > 0 ? (
                            filteredPlugins.map((plugin, index) =>
                                <Plugin
                                    plugin={plugin}
                                    key={plugin.key || index}
                                    userPlugins={userPlugins}
                                    channels={channels}
                                    __={__}
                                />
                            )
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} align="center" sx={{ py: 4, color: 'var(--text-secondary)' }}>
                                    No plugins in this category.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    )
}
