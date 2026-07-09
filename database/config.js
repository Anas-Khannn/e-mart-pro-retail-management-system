function hasConcreteUrl(value) {
  return value && value.startsWith('mysql://') && !value.includes('${{');
}

function firstConcrete(...values) {
  return values.find((value) => value && !String(value).includes('${{'));
}

function getDatabaseConfig() {
  const url = process.env.DB_URL || process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL;

  if (hasConcreteUrl(url)) {
    const parsed = new URL(url);

    return {
      host: parsed.hostname,
      port: Number(parsed.port || 3306),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, '') || 'emart_db'
    };
  }

  return {
    host: firstConcrete(process.env.MYSQLHOST, process.env.DB_HOST) || 'localhost',
    port: Number(firstConcrete(process.env.MYSQLPORT, process.env.DB_PORT) || 3306),
    user: firstConcrete(process.env.MYSQLUSER, process.env.DB_USER) || 'root',
    password: firstConcrete(process.env.MYSQLPASSWORD, process.env.MYSQL_ROOT_PASSWORD, process.env.DB_PASSWORD) || '',
    database: firstConcrete(process.env.MYSQLDATABASE, process.env.MYSQL_DATABASE, process.env.DB_NAME) || 'emart_db'
  };
}

module.exports = getDatabaseConfig;
