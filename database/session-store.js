const session = require('express-session');
const mysql = require('./db');

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

class MySQLSessionStore extends session.Store {
  get(sid, callback) {
    mysql.query('SELECT data, expires FROM sessions WHERE session_id = ? LIMIT 1', [sid])
      .then(async ([rows]) => {
        if (rows.length === 0) {
          callback(null, null);
          return;
        }

        const record = rows[0];
        if (Number(record.expires) <= Date.now()) {
          await this.destroy(sid);
          callback(null, null);
          return;
        }

        callback(null, JSON.parse(record.data));
      })
      .catch((error) => callback(error));
  }

  set(sid, sess, callback = () => {}) {
    const expires = this.getExpiresAt(sess);
    const data = JSON.stringify(sess);

    mysql.query(`
      INSERT INTO sessions (session_id, expires, data)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE expires = VALUES(expires), data = VALUES(data)
    `, [sid, expires, data])
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  destroy(sid, callback = () => {}) {
    mysql.query('DELETE FROM sessions WHERE session_id = ?', [sid])
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  touch(sid, sess, callback = () => {}) {
    const expires = this.getExpiresAt(sess);

    mysql.query('UPDATE sessions SET expires = ? WHERE session_id = ?', [expires, sid])
      .then(() => callback(null))
      .catch((error) => callback(error));
  }

  getExpiresAt(sess) {
    if (sess.cookie?.expires) {
      const expires = new Date(sess.cookie.expires).getTime();
      if (!Number.isNaN(expires)) return expires;
    }

    return Date.now() + (sess.cookie?.originalMaxAge || ONE_DAY_MS);
  }
}

module.exports = MySQLSessionStore;
