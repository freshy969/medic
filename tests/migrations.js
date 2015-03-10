var sinon = require('sinon'),
    migrations = require('../migrations'),
    db = require('../db');

exports.tearDown = function (callback) {
  if (db.getView.restore) {
    db.getView.restore();
  }
  if (db.saveDoc.restore) {
    db.saveDoc.restore();
  }
  if (migrations.get.restore) {
    migrations.get.restore();
  }
  callback();
};

exports['run does nothing if no migrations'] = function(test) {
  test.expect(2);
  var getView = sinon.stub(db, 'getView').callsArgWith(2, null, { rows: [] });
  var getMigrations = sinon.stub(migrations, 'get').callsArgWith(0, null, []);
  migrations.run(function(err) {
    test.equals(err, undefined);
    test.equals(getView.callCount, 1);
    test.done();
  });
};

exports['run does nothing if all migrations have run'] = function(test) {
  test.expect(2);
  var meta = { migrations: [ 'xyz' ] };
  var getView = sinon.stub(db, 'getView').callsArgWith(2, null, { rows: [ { doc: meta } ] });
  var getMigrations = sinon.stub(migrations, 'get').callsArgWith(0, null, [ { name: 'xyz' } ]);
  migrations.run(function(err) {
    test.equals(err, undefined);
    test.equals(getView.callCount, 1);
    test.done();
  });
};

exports['executes migrations that have not run and updates meta'] = function(test) {
  test.expect(5);
  var migration = [
    {
      name: 'xyz',
      run: function(callback) {
        test.ok(true);
        callback();
      }
    },
    {
      name: 'abc',
      run: function(callback) {
        test.ok(false);
        callback();
      }
    }
  ];
  var meta = { _id: 1, migrations: [ 'abc' ], type: 'meta' };
  var getView = sinon.stub(db, 'getView').callsArgWith(2, null, { rows: [ { doc: meta } ] });
  var getMigrations = sinon.stub(migrations, 'get').callsArgWith(0, null, migration);
  var saveDoc = sinon.stub(db, 'saveDoc').callsArg(1);
  migrations.run(function(err) {
    test.equals(err, undefined);
    test.equals(getView.callCount, 2);
    test.equals(saveDoc.callCount, 1);
    test.deepEqual(saveDoc.firstCall.args[0], {
      _id: 1,
      migrations: [ 'abc', 'xyz' ],
      type: 'meta'
    });
    test.done();
  });
};

exports['executes multiple migrations that have not run and updates meta each time'] = function(test) {
  test.expect(7);
  var migration = [
    {
      name: 'xyz',
      run: function(callback) {
        test.ok(true);
        callback();
      }
    },
    {
      name: 'abc',
      run: function(callback) {
        test.ok(true);
        callback();
      }
    }
  ];
  var getView = sinon.stub(db, 'getView');
  getView.onFirstCall().callsArgWith(2, null, { rows: [ { doc: { _id: 1, migrations: [ ], type: 'meta' } } ] });
  getView.onSecondCall().callsArgWith(2, null, { rows: [ { doc: { _id: 1, migrations: [ ], type: 'meta' } } ] });
  getView.onThirdCall().callsArgWith(2, null, { rows: [ { doc: { _id: 1, migrations: [ 'xyz' ], type: 'meta' } } ] });
  var getMigrations = sinon.stub(migrations, 'get').callsArgWith(0, null, migration);
  var saveDoc = sinon.stub(db, 'saveDoc').callsArg(1);
  migrations.run(function(err) {
    test.equals(err, undefined);
    test.equals(getView.callCount, 3);
    test.equals(saveDoc.callCount, 2);
    test.deepEqual(saveDoc.firstCall.args[0], {
      _id: 1,
      migrations: [ 'xyz' ],
      type: 'meta'
    });
    test.deepEqual(saveDoc.secondCall.args[0], {
      _id: 1,
      migrations: [ 'xyz', 'abc' ],
      type: 'meta'
    });
    test.done();
  });
};

exports['executes multiple migrations and stops when one errors'] = function(test) {
  test.expect(6);
  var migration = [
    {
      name: 'a',
      run: function(callback) {
        test.ok(true);
        callback();
      }
    },
    {
      name: 'b',
      run: function(callback) {
        test.ok(true);
        callback('boom!');
      }
    },
    {
      name: 'c',
      run: function(callback) {
        test.ok(false);
        callback();
      }
    }
  ];
  var getView = sinon.stub(db, 'getView');
  getView.onFirstCall().callsArgWith(2, null, { rows: [ { doc: { _id: 1, migrations: [ ], type: 'meta' } } ] });
  getView.onSecondCall().callsArgWith(2, null, { rows: [ { doc: { _id: 1, migrations: [ ], type: 'meta' } } ] });
  var getMigrations = sinon.stub(migrations, 'get').callsArgWith(0, null, migration);
  var saveDoc = sinon.stub(db, 'saveDoc').callsArg(1);
  migrations.run(function(err) {
    test.equals(err, 'Migration "b" failed with: "boom!"');
    test.equals(getView.callCount, 2);
    test.equals(saveDoc.callCount, 1);
    test.deepEqual(saveDoc.firstCall.args[0], {
      _id: 1,
      migrations: [ 'a' ],
      type: 'meta'
    });
    test.done();
  });
};

exports['creates meta if needed'] = function(test) {
  test.expect(5);
  var migration = [
    {
      name: 'xyz',
      run: function(callback) {
        test.ok(true);
        callback();
      }
    }
  ];
  var getView = sinon.stub(db, 'getView').callsArgWith(2, null, { rows: [ ] });
  var getMigrations = sinon.stub(migrations, 'get').callsArgWith(0, null, migration);
  var saveDoc = sinon.stub(db, 'saveDoc').callsArg(1);
  migrations.run(function(err) {
    test.equals(err, undefined);
    test.equals(getView.callCount, 2);
    test.equals(saveDoc.callCount, 1);
    test.deepEqual(saveDoc.firstCall.args[0], {
      migrations: [ 'xyz' ],
      type: 'meta'
    });
    test.done();
  });
};
