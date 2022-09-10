import { openDB, IDBPDatabase } from 'idb/with-async-ittr';
import settings from './settings.json';

/**
 * @type {IDBPDatabase<unknown>}
 */
let db;
async function init() {
    db = await openDB('database', settings.version, {
        upgrade(db) {
            const default_db = {};
            try {
                const default_db_file = require('./default.json');
                for (let i = 0; i < default_db_file.length; i++) {
                    const table = default_db_file[i];
                    default_db[table.name] = table;
                }
            } catch {};

            for (const table in settings.tables) {
                const store = db.createObjectStore(table, {
                    keyPath: '_id',
                    autoIncrement: true
                });
                for (const key in settings.tables[table]) {
                    store.createIndex(key, settings.tables[table][key]);
                }

                if (store.name in default_db) {
                    for (let j = 0; j < default_db[store.name].data.length; j++) {
                        const data = default_db[store.name].data[j];
                        store.add(data);
                    }
                }
            }
        }
    });
}

async function get(table, index_key, value=null, offset=0, limit=null, reverse=false) {
    const tx = db.transaction(table, 'readwrite');
    
    let data_list = [];
    const index = tx.store.index(index_key);
    let skip = Number.isInteger(offset) && offset > 0;
    for await (const index_cursor of index.iterate(value, reverse ? 'prev' : undefined)) {
        if (skip) {
            index_cursor.advance(offset);
            skip = false;
        } else {
            data_list.push(index_cursor.value);
            if (Number.isInteger(limit) && data_list.length === limit) break;
        }
    }

    await tx.done;
    return data_list;
}

async function update(table, index_key, value, new_data, once=true) {
    const tx = db.transaction(table, 'readwrite');
    const index = tx.store.index(index_key);

    for await (const index_cursor of index.iterate(value)) {
        const value = {
            ...index_cursor.value,
            ...new_data
        };
        index_cursor.update(value);
        if (once) break;
    }

    await tx.done;
}

async function add(table, value) {
    return db.add(table, value);
}

async function delete_data(table, index_key, value, once=true) {
    const tx = db.transaction(table, 'readwrite');
    const index = tx.store.index(index_key);

    for await (const index_cursor of index.iterate(value)) {
        index_cursor.delete();
        if (once) break;
    }

    await tx.done;
}

const db_manager = { get, add, update, delete: delete_data };
export { db, init };
export default db_manager;