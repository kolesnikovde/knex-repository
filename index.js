var Promise = require('bluebird');

module.exports = Repository;

/**
 * @param {Object} options
 * @param {Object} options.db
 * @param {String} options.tableName=
 * @param {Object} options.scope=
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
 * Default primary key.
 */

proto.pk = 'id';

/**
 * Default entity class.
 */

proto.entityClass = null;

/**
 * Default timestamps.
 */

proto.timestamps = {
  createdAt: 'created_at',
  updatedAt: 'updated_at'
};

/**
 * @param {Function} entity
 */

Repository.entity = function(entity) {
  proto.entityClass = entity;
}

/**
 * @param {mixed} pk
 */

Repository.pk = function(pk) {
  proto.pk = pk;
}

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

proto.scope = function() {
  return this._scope.clone();
}

proto.then = function(fn) {
  return this.fetch(this._scope).then(fn);
}

proto.reject = function(fn) {
  return this._scope.reject(fn);
}

proto.finally = function(fn) {
  return this._scope.finally(fn);
}

/**
 * @param {Function} fn= - will be invoked in knex scope
 * @param {Array} args=
 * @returns {Repository}
 */

proto.scoped = function(fn, args) {
  return new this.constructor({
    db: this.db,
    scope: fn ? fn.apply(this.scope(), args) : this.scope()
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
 *         // some persistency logic
 *         clients.updateLastOrder(order)
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
 * @returns {Promise} - resolves with list of records
 */

proto.all = function(conditions) {
  return this.scoped(conditions && function() {
    return this.where(conditions);
  });
}

/**
 * @param {Object} conditions=
 * @returns {Promise} - resolves with record or null
 */

proto.first = function(conditions) {
  return this.fetchOne(this.scope().where(conditions || {}).limit(1));
}

/**
 * @param {Object} fields=
 * @returns {Promise} - resolves with created record
 */

proto.create = function(fields) {
  fields || (fields = {});
  this.updateTimestamps(fields, 'createdAt', 'updatedAt');

  return this.fetchOne(this.scope().insert(fields).returning('*'));
}

/**
 * @param {mixed} pk
 * @param {Object} fields=
 * @returns {Promise} - resolves with updated record
 */

proto.update = function(pk, fields) {
  fields || (fields = {});

  return this.fetchOne(this.updateAll(this.pkConditions(pk), fields).returning('*'));
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
 * @param {mixed} pk
 * @returns {Promise} - resolves with deleted record
 */

proto.destroy = function(pk) {
  return this.fetchOne(this.destroyAll(this.pkConditions(pk)).returning('*'));
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
 * @param {mixed} pk
 * @returns {Object}
 */

proto.pkConditions = function(pk) {
  var cond = {},
      pkCol = this.pk;

  if (Array.isArray(pkCol)) {
    for (var i = 0, l = pkCol.length; i < l; ++i) {
      cond[pkCol[i]] = pk[i];
    }
  } else {
    cond[pkCol] = pk;
  }

  return cond;
}


/**
 * @param {Promise} promise
 * @returns {Object[]}
 */

proto.fetch = function(promise) {
  var entityClass = this.entityClass;

  return promise.then(function(res) {
    if (!Array.isArray(res) || !entityClass) return res;

    return res.map(function(r) { return new entityClass(r) });
  });
}

/**
 * @param {Promise} promise
 * @returns {Object}
 */

proto.fetchOne = function(promise) {
  return this.fetch(promise).then(function(res) { return res.pop() });
}

/**
 * Updates timestamps.
 *
 * @param {Object} fields
 * @param {...ts} ts
 */

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
}

/**
 * @param {String|String[]} value
 * @returns {String}
 */

proto.quote = function(value) {
  return Array.isArray(value)
    ? value.map(proto.quote).join(',')
    : "'" + value + "'";
}

/**
 * @returns {Object}
 */

proto.toSQL = function() {
  return this._scope.toSQL();
}
