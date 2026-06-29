import * as React from 'react'
import { Paper, Typography, Grid } from '@mui/material'

let assetsCache = null

export default function Resources({ __, openResources: rawResources, languageCode }) {
    const [assets, setAssets] = React.useState(assetsCache || {})

    React.useEffect(() => {
        if (!assetsCache) {
            fetch('/assets.json')
              .then(res => res.json())
              .then(json => {
                assetsCache = json
                setAssets(json)
              })
              .catch(err => console.error("Failed to fetch assets.json in Resources component:", err))
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
