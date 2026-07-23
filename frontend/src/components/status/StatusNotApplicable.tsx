import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { Box, Tooltip } from '@mui/material';

export interface StatusNotApplicableProps {
  label: string;
  testId?: string;
}

export default function StatusNotApplicable({ label, testId }: StatusNotApplicableProps) {
  return (
    <Tooltip title={label} describeChild>
      <Box
        component="span"
        role="img"
        aria-label={label}
        data-testid={testId}
        sx={{
          width: 24,
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.disabled',
          cursor: 'default',
        }}
      >
        <RemoveRoundedIcon sx={{ fontSize: 13 }} />
      </Box>
    </Tooltip>
  );
}
