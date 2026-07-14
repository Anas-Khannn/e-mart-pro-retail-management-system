function hasConcreteUrl(value) {
  return value && value.startsWith('mysql://') && !value.includes('${{');
}

function firstConcrete(...values) {
  return values.find((value) => value && !String(value).includes('${{'));
}

function assertProductionHost(config) {
  const isHostedProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
  const localHosts = ['localhost', '127.0.0.1', '::1'];

  if (isHostedProduction && localHosts.includes(config.host)) {
    throw new Error('Production database host is not configured. Set DB_HOST to the Aiven host.');
  }
}

function buildSslConfig(url, explicitSsl) {
  if (explicitSsl || (url && url.includes('ssl-mode=REQUIRED'))) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function getDatabaseConfig() {
  const url = process.env.DB_URL || process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL;
  const explicitSsl = String(process.env.DB_SSL || '').toLowerCase() === 'true';

  if (hasConcreteUrl(url)) {
    const parsed = new URL(url);

    const config = {
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, '') || 'emart_db'
    };

    const ssl = buildSslConfig(url, explicitSsl);
    if (ssl) config.ssl = ssl;

    assertProductionHost(config);
    return config;
  }

  const config = {
    host: firstConcrete(process.env.DB_HOST, process.env.MYSQLHOST) || 'localhost',
    port: Number(firstConcrete(process.env.DB_PORT, process.env.MYSQLPORT) || 3306),
    user: firstConcrete(process.env.DB_USER, process.env.MYSQLUSER) || 'root',
    password: firstConcrete(process.env.DB_PASSWORD, process.env.MYSQL_ROOT_PASSWORD, process.env.MYSQLPASSWORD) || '',
    database: firstConcrete(process.env.DB_NAME, process.env.MYSQL_DATABASE, process.env.MYSQLDATABASE) || 'emart_db'
  };

  const ssl = buildSslConfig(url, explicitSsl);
  if (ssl) config.ssl = ssl;

  assertProductionHost(config);
  return config;
}

module.exports = getDatabaseConfig;
