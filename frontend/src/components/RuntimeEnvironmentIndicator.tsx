import React from 'react';
import Chip from '@mui/material/Chip';
import { apiFetch } from '../services/apiFetch';
import { environmentColors } from '../theme/functional';

type RuntimeInfo = {
  appEnv: 'development' | 'production';
  dbTarget: 'local' | 'server' | 'production';
};

const AUTHORIZED_EMAIL = 'adiaz@emphasys.mx';

function getLabel(info: RuntimeInfo): string | null {
  if (info.appEnv === 'production' && info.dbTarget === 'production') return 'PRODUCCIÓN';
  if (info.appEnv === 'development' && info.dbTarget === 'local') return 'LOCAL · BD LOCAL';
  if (info.appEnv === 'development' && info.dbTarget === 'server') return 'LOCAL · BD SERVIDOR';
  return null;
}

export default function RuntimeEnvironmentIndicator({ email }: { email?: string | null }) {
  const [info, setInfo] = React.useState<RuntimeInfo | null>(null);

  React.useEffect(() => {
    let active = true;
    if (email !== AUTHORIZED_EMAIL) {
      setInfo(null);
      return () => { active = false; };
    }

    void apiFetch<RuntimeInfo>('/api/runtime-info')
      .then((runtimeInfo) => {
        if (active) setInfo(runtimeInfo);
      })
      .catch(() => {
        if (active) setInfo(null);
      });

    return () => { active = false; };
  }, [email]);

  if (email !== AUTHORIZED_EMAIL || !info) return null;

  const label = getLabel(info);
  if (!label) return null;

  const warning = info.dbTarget === 'server';
  const production = info.appEnv === 'production';

  return (
    <Chip
      label={label}
      size="small"
      sx={{
        fontWeight: 800,
        letterSpacing: 0.35,
        color: production ? '#fff' : warning ? environmentColors.warningText : environmentColors.defaultText,
        backgroundColor: production ? environmentColors.productionBackground : warning ? environmentColors.warningBackground : environmentColors.defaultBackground,
        border: production ? `1px solid ${environmentColors.productionBorder}` : warning ? `1px solid ${environmentColors.warningBorder}` : `1px solid ${environmentColors.defaultBorder}`,
        '& .MuiChip-label': { px: 1.1 },
      }}
    />
  );
}
