# knex-repository

Fat-free repository pattern implementation on top of [knex.js](http://knexjs.org/).

### Installation

    $ npm i knex-repository

### Usage

```js
var util       = require('util');
var knex       = require('knex')({ dialect: 'postgres', connection: /* ... */ });
var Repository = require('knex-repository');

function ClientsRepository(options) {
  this.tableName = 'clients';
  // optional
  this.entityClass = Client;
  // default
  this.pk = 'id';
  Repository.call(this, options);
}

util.inherits(ClientsRepository, Repository);

var proto = ClientsRepository.prototype;

proto.online = function() {
  return this.scoped(function() {
    return this.where('last_seen_at', '>=', new Date(Date.now() - 15 * 60000));
  });
}

proto.byActivity = function() {
  return this.scoped(function() {
    return this.order('last_seen_at', 'desc');
  });
}

var clients = new ClientsRepository({ db: knex });

clients.create({ firstName: 'John', secondName: 'Doe' }).then(function(c) {
  // c is a Client
});

clients.byActivity().online().then(function(cs) {
  // cs is a Client[]
});
```

CoffeeScript:
```coffeescript
class ClientsRepository extends Repository
  tableName: 'clients'
  pk: 'id'
  entityClass: Client

  @scopes
    online: ->
      @where('last_seen_at', '>=', new Date(Date.now() - 15 * 60 * 1000))

  byActivity: ->
    @scoped -> @order('last_seen_at', 'desc')
```

### Supported databases

- PostgreSQL

### License

MIT
