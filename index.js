var Promise = require('bluebird');

module.exports = Repository;

/**
 * @param {Object} options
 * @param {Object} options.db
 * @param {String} options.tableName=
 * @param {Repository} options.scope=
 */

function Repository(options) {
  options || (options = {});

  this.db = options.db;

  if (options.tableName) {
    this.tableName = options.tableName;
  }

  this._scope = options.scope || this.db(this.tableName);
}

var proto = Repository.prototype;

/**
 * Default table name.
 */

proto.tableName = null;

/**
 * Default timestamps.
 */

proto.timestamps = {
  createdAt: 'created_at',
  updatedAt: 'updated_at'
};

/**
 * @param {Object} scopes - scopeName => fn
 */

Repository.scopes = function(scopes) {
  Object.keys(scopes).forEach(function(key) {
    proto[key] = function() {
      return this.scoped(scopes[key], arguments);
    }
  });
}

/**
 * @returns {Object}
 */

proto.scope = function() {
  return this._scope.clone();
}

proto.then = function(fn) {
  return this._scope.then(fn);
}

proto.reject = function(fn) {
  return this._scope.reject(fn);
}

proto.finally = function(fn) {
  return this._scope.finally(fn);
}

/**
 * @param {Function} fn - will be invoked in knex scope
 * @param {Array} args=
 * @returns {Repository}
 */

proto.scoped = function(fn, args) {
  return new this.constructor({
    db: this.db,
    scope: fn.apply(this.scope(), args)
  });
}

/**
 * Example:
 *   knex.transaction(function(trx) {
 *     var orders = orders.transacting(trx);
 *     var clients = clients.transacting(trx);
 *
 *     orders.create(fields)
 *       .then(function(order) {
 *         clients.update(order.client_id, { last_order_id: order.id })
 *                .then(trx.commit)
 *                .catch(trx.rollback);
 *       })
 *       .catch(trx.rollback);
 *   });
 *
 * @param {Object} trx - knex or knex transaction
 * @returns {Repository}
 */

proto.transacting = function(trx) {
  return new this.constructor({ db: trx });
}

/**
 * @param {Object} conditions=
 * @returns {Promise} - resolves with object or null
 */

proto.all = function(conditions) {
  if (conditions) {
    return this.scoped(function() { return this.where(conditions) });
  } else {
    return this.scope();
  }
}

/**
 * @param {Object} conditions=
 * @returns {Promise} - resolves with object or null
 */

proto.first = function(conditions) {
  return this.fetchOne(this.scope().where(conditions || {}).limit(1));
}

/**
 * @param {Object} fields=
 * @returns {Promise} - resolves with created object
 */

proto.create = function(fields) {
  fields || (fields = {});
  this.updateTimestamps(fields, 'createdAt', 'updatedAt');

  return this.fetchOne(this.scope().insert(fields).returning('*'));
}

/**
 * @param {Integer} id
 * @param {Object} fields=
 * @returns {Promise} - resolves with updated object
 */

proto.update = function(id, fields) {
  fields || (fields = {});

  return this.fetchOne(this.updateAll({ id: id }, fields).returning('*'));
}

/**
 * @param {Object} conditions=
 * @param {Object} fields
 * @returns {Promise}
 */

proto.updateAll = function(conditions, fields) {
  if (!fields) {
    fields = conditions;
    conditions = {}
  }

  this.updateTimestamps(fields, 'updatedAt');

  return this.scope().where(conditions).update(fields);
}

/**
 * @param {String} [expression='*']
 * @returns {Promise} - resolves count
 */

proto.count = function(expression) {
  expression || (expression = '*');

  var self = this;

  return new Promise(function(resolve, reject) {
    self
      .scope()
      .count(expression)
      .then(function(count) { resolve(parseInt(count[0].count, 10)) })
      .catch(reject);
  });
}

/**
 * @param {Integer} id
 * @returns {Promise} - resolves with deleted object
 */

proto.destroy = function(id) {
  return this.fetchOne(this.destroyAll({ id: id }).returning('*'));
}

/**
 * @param {Object} conditions=
 * @returns {Promise}
 */

proto.destroyAll = function(conditions) {
  return this.scope().where(conditions || {}).delete();
}

// Utils.

/**
 * @param {String|Array} value
 * @returns {String}
 */

proto.quote = function(value) {
  return Array.isArray(value)
    ? value.map(proto.quote).join(',')
    : "'" + value + "'";
}

proto.fetchOne = function(promise) {
  return promise.then(function(rows) { return Promise.resolve(rows.pop()) });
}

proto.updateTimestamps = function(fields) {
  if (!this.timestamps) return;

  var ts = [].slice.call(arguments, 1),
      timestamps = this.timestamps,
      now = new Date(),
      column;

  for (var i = 0, l = ts.length; i < l; ++i) {
    var column = timestamps[ts[i]];

    if (column) {
      fields[column] || (fields[column] = now);
    }
  }

  return fields;
}

proto.toSQL = function() {
  return this._scope.toSQL();
}
