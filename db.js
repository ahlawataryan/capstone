// db.js
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const filepath = "./capstone.db";

function createDbConnection() {
  if (fs.existsSync(filepath)) {
    console.log("Connecting to existing database");
    return new sqlite3.Database(filepath);
  } else {
    console.log("Creating new database and connecting");
    const db = new sqlite3.Database(filepath, (error) => {
      if (error) {
        return console.error(error.message);
      }
      createTable(db);
    });
    return db;
  }
}

function createTable(db) {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      accountType TEXT NOT NULL CHECK(accountType IN ('Admin','Client','Student'))
    );

  `;

  db.run(createTableSql, (err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log("Table created successfully");
  });
}

module.exports = createDbConnection();

