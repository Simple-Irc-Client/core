import React from 'react';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useCurrentStore } from '../store/current';

const Typing = (): JSX.Element => {
  const { t } = useTranslation();

  const typing = useCurrentStore((state) => state.typing);

  return (
    <Box sx={{ fontSize: '12px', height: '28px', marginLeft: '16px' }}>
      {typing.length !== 0 && (
        <>
          {typing.join(', ')}
          &nbsp;{t('main.user-typing')}
        </>
      )}
    </Box>
  );
};

export default Typing;
