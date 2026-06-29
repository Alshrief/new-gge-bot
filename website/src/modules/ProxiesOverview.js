import * as React from 'react'
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material'
import ShieldIcon from '@mui/icons-material/Shield'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'

export default function ProxiesOverview({ users, __ }) {
  return (
    <Box sx={{ width: '100%', animation: 'fadeIn 0.5s ease' }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <ShieldIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {__('proxiesOverview') || 'إدارة بروكسيات الحماية (Proxies)'}
          </Typography>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{__('gameAccount') || 'حساب اللعبة'}</TableCell>
                <TableCell>{__('proxyHost') || 'الخادم (Host)'}</TableCell>
                <TableCell>{__('proxyPort') || 'المنفذ (Port)'}</TableCell>
                <TableCell>{__('proxyType') || 'النوع (Type)'}</TableCell>
                <TableCell>{__('proxyStatus') || 'حالة البروكسي'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 4 }}>
                      {__('noAccountsAddedYet') || 'لم يتم إضافة حسابات بعد.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((bot) => {
                  const hasProxy = bot.proxyHost && bot.proxyPort
                  return (
                    <TableRow key={bot.id}>
                      <TableCell sx={{ fontWeight: 600 }}>{bot.name}</TableCell>
                      <TableCell>{bot.proxyHost || '-'}</TableCell>
                      <TableCell>{bot.proxyPort || '-'}</TableCell>
                      <TableCell>
                        {bot.proxyType ? (
                          <Chip label={bot.proxyType.toUpperCase()} size="small" color="secondary" variant="outlined" />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {hasProxy ? (
                          bot.proxyEnabled ? (
                            <Chip
                              icon={<CheckCircleIcon />}
                              label={__('proxyEnabled') || 'نشط ومفعل'}
                              color="success"
                              size="small"
                            />
                          ) : (
                            <Chip
                              icon={<CancelIcon />}
                              label={__('proxyDisabled') || 'معطل'}
                              color="warning"
                              size="small"
                              variant="outlined"
                            />
                          )
                        ) : (
                          <Chip
                            label={__('noProxy') || 'غير محمي (مباشر)'}
                            size="small"
                            sx={{ color: '#888', border: '1px dashed #444', background: 'transparent' }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
