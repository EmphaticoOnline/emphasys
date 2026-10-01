import * as React from 'react';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { SvgIconComponent } from '@mui/icons-material';

export function ConfigPageFrame({ children }: { children: React.ReactNode }) {
  const tokens = useTheme().emphasys;

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        px: { xs: 1.5, md: 2.75 },
        py: 1.6,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        bgcolor: tokens.content.background,
      }}
    >
      {children}
    </Box>
  );
}

export function ConfigPageHeader({
  eyebrow = 'Configuración',
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const tokens = useTheme().emphasys;

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.25}
      alignItems={{ sm: 'flex-end' }}
      justifyContent="space-between"
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11, letterSpacing: '0.14em', fontWeight: 700, color: tokens.content.muted, textTransform: 'uppercase' }}>
          {eyebrow}
        </Typography>
        <Typography variant="figure" sx={{ mt: 0.35, fontSize: { xs: 26, md: 32 }, letterSpacing: '-0.02em', lineHeight: 1, color: tokens.content.foreground }}>
          {title}
        </Typography>
        {description ? (
          <Typography sx={{ mt: 0.7, fontSize: 13, color: tokens.content.secondary, maxWidth: 640 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {actions ? <Box sx={{ flexShrink: 0 }}>{actions}</Box> : null}
    </Stack>
  );
}

export function ConfigSection({
  title,
  children,
  columns = 1,
}: {
  title: string;
  children: React.ReactNode;
  columns?: 1 | 2;
}) {
  const tokens = useTheme().emphasys;

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: `1px solid ${tokens.content.border}`,
        bgcolor: tokens.content.elevated,
        px: 1.25,
        py: 1,
        minWidth: 0,
      }}
    >
      <Typography
        sx={{
          px: 0.75,
          pb: 0.65,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: tokens.content.muted,
        }}
      >
        {title}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: columns === 2 ? { xs: '1fr', md: '1fr 1fr' } : '1fr',
          columnGap: 0.5,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export function ConfigNavRow({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon?: SvgIconComponent;
  title: string;
  description?: string | null;
  onClick: () => void;
}) {
  const tokens = useTheme().emphasys;

  return (
    <ButtonBase
      onClick={onClick}
      focusRipple
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 1.1,
        textAlign: 'left',
        px: 1,
        py: 0.75,
        borderRadius: 2,
        color: tokens.content.foreground,
        transition: 'background-color 0.15s',
        '&:hover': { bgcolor: tokens.content.hover },
        '&:active': { bgcolor: tokens.grid.selected },
        '&.Mui-focusVisible': {
          outline: `2px solid ${tokens.content.foreground}`,
          outlineOffset: 2,
        },
      }}
    >
      {Icon ? (
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '10px',
            bgcolor: tokens.action.tint,
            color: tokens.content.foreground,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 16 }} />
        </Box>
      ) : null}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.25, color: tokens.content.foreground }}>
          {title}
        </Typography>
        {description ? (
          <Typography
            sx={{
              mt: 0.15,
              fontSize: 12,
              lineHeight: 1.35,
              color: tokens.content.muted,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {description}
          </Typography>
        ) : null}
      </Box>
      <ChevronRightIcon sx={{ fontSize: 18, color: tokens.content.muted, flexShrink: 0 }} />
    </ButtonBase>
  );
}
