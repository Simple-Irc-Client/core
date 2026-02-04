const getParams = () => new URLSearchParams(window.location.search);

export const getServerParam = (): string | undefined => {
  return getParams().get('server') ?? undefined;
};

export const getPortParam = (): number | undefined => {
  const port = getParams().get('port');
  if (port) {
    const parsed = parseInt(port, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 65535) {
      return parsed;
    }
  }
  return undefined;
};

export const getTlsParam = (): boolean | undefined => {
  const tls = getParams().get('tls');
  if (tls === 'true' || tls === '1') {
    return true;
  }
  if (tls === 'false' || tls === '0') {
    return false;
  }
  return undefined;
};

export const getChannelParam = (): string[] | undefined => {
  let channelParam = getParams().get('channel');

  // Fallback: if URL has `channel=` followed by `#channel`, the browser treats `#channel` as fragment
  // e.g., `?channel=#general` → search="?channel=", hash="#general"
  if (!channelParam && window.location.hash && window.location.search.includes('channel=')) {
    channelParam = window.location.hash;
  }

  if (!channelParam) {
    return undefined;
  }

  // Split by comma and filter out empty strings
  const channels = channelParam.split(',').map((c) => c.trim()).filter((c) => c.length > 0);
  return channels.length > 0 ? channels : undefined;
};
