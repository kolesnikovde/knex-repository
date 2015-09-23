var util       = require('util');
var assert     = require('assert');
var Promise    = require('bluebird');
var Repository = require('./');

// Connection.
var knex = require('knex')({
  dialect: 'postgres',
  connection: process.env.DB || 'postgres://localhost/postgres'
});

var testTableName = 'knex_repository_test';

// Sample repository.
function RecordsRepository(options) {
  this.tableName = testTableName;
  this.entityClass = Record;
  Repository.call(this, options);
}

util.inherits(RecordsRepository, Repository);

Repository.scopes.call(RecordsRepository, {
  bars: function() {
    return this.where('name', 'bar');
  }
});

// "Model" class.
function Record(props) {
  // _.extend(this, props);
  for (var key in props) this[key] = props[key];
}

var records = new RecordsRepository({ db: knex });

describe('Repository', function() {
  // Setup/cleanup repository table.
  before(function(done) {
    knex.schema
        .createTable(testTableName, function(table) {
          table.increments('id');
          table.string('name');
          table.dateTime('updated_at');
          table.dateTime('created_at');
        })
        .then(function() { done() });
  });

  after(function(done) {
    knex.schema
        .dropTable(testTableName)
        .then(function() { done() });
  });

  beforeEach(function(done) {
    records.scope().truncate().then(function() { done() });
  });

  describe('#create', function() {
    it('creates record', function(done) {
      records.create().then(function(r1) {
        assert.equal(r1 instanceof Record, true);

        records.count().then(function(count) {
          assert.equal(count, 1);

          records.first().then(function(r2) {
            assert.deepEqual(r2, r1);
            done();
          });
        });
      });
    });
  });

  describe('#update', function() {
    it('updates record by id', function(done) {
      records.create().then(function(r1) {
        records.update(r1.id, { name: 'foo' }).then(function(r2) {
          assert.equal(r1.updated_at.toString(), r2.updated_at.toString());
          done();
        });
      });
    });
  });

  describe('#updateAll', function() {
    it('updates matching records', function(done) {
      Promise.join(
        records.create({ name: 'foo' }),
        records.create({ name: 'foo' }),
        records.create()
      ).then(function() {
        records.updateAll({ name: 'foo' }, { name: 'bar' }).then(function() {
          records.all({ name: 'bar' }).count().then(function(count) {
            assert.equal(count, 2);
            done();
          });
        });
      });
    });

    it('conditions is optional', function(done) {
      Promise.join(
        records.create(),
        records.create(),
        records.create()
      ).then(function() {
        records.updateAll({ name: 'foo' }).then(function() {
          records.all({ name: 'foo' }).count().then(function(count) {
            assert.equal(count, 3);
            done();
          });
        });
      });
    });
  });

  describe('#destroy', function() {
    it('destroys record by id', function(done) {
      records.create().then(function(r1) {
        records.destroy(r1.id).then(function(r2) {
          assert.deepEqual(r1, r2);
          records.count().then(function(count) {
            assert.equal(count, 0);
            done();
          });
        });
      });
    });
  });

  describe('#destroyAll', function() {
    it('destroys matching records', function(done) {
      Promise.join(
        records.create({ name: 'foo' }),
        records.create({ name: 'foo' }),
        records.create()
      ).then(function() {
        records.destroyAll({ name: 'foo' }).then(function() {
          records.count().then(function(count) {
            assert.equal(count, 1);
            done();
          });
        });
      });
    });

    it('conditions is optional', function(done) {
      Promise.join(
        records.create(),
        records.create(),
        records.create()
      ).then(function() {
        records.destroyAll().then(function() {
          records.count().then(function(count) {
            assert.equal(count, 0);
            done();
          });
        });
      });
    });
  });

  describe('.scopes', function() {
    it('defines scopes', function(done) {
      Promise.join(
        records.create({ name: 'foo' }),
        records.create({ name: 'bar' }),
        records.create()
      ).then(function() {
        records.bars().then(function(bars) {
          assert.equal(bars.length, 1);
          assert.equal(bars[0].name, 'bar');
          assert.equal(bars[0] instanceof Record, true);
          done();
        });
      });
    });
  });
});
