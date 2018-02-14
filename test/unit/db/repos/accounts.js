/*
 * Copyright © 2018 Lisk Foundation
 *
 * See the LICENSE file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with the Lisk Foundation,
 * no part of this software, including this file, may be copied, modified,
 * propagated, or distributed except according to the terms contained in the
 * LICENSE file.
 *
 * Removal or modification of this copyright notice is prohibited.
 */

'use strict';

const Promise = require('bluebird');
const randomstring = require('randomstring');
const DBSandbox = require('../../../common/db_sandbox').DBSandbox;
const accountFixtures = require('../../../fixtures').accounts;
const accountsSQL = require('../../../../db/sql').accounts;
const seeder = require('../../../common/db_seed');

let db;
let dbSandbox;
let validAccount;

function createAccount() {
	validAccount = accountFixtures.Account();

	return db
		.query(db.$config.pgp.helpers.insert(validAccount, db.accounts.cs.insert))
		.then(() => {
			return validAccount;
		});
}

describe('db', () => {
	before(done => {
		dbSandbox = new DBSandbox(__testContext.config.db, 'lisk_test_db_accounts');

		dbSandbox.create((err, __db) => {
			db = __db;

			done(err);
		});
	});

	after(() => {
		dbSandbox.destroy();
	});

	beforeEach(done => {
		seeder
			.seed(db)
			.then(() => done(null))
			.catch(done);
	});

	afterEach(done => {
		sinonSandbox.restore();
		seeder
			.reset(db)
			.then(() => done(null))
			.catch(done);
	});

	it('should initialize db.accounts repo', () => {
		expect(db.accounts).to.be.not.null;
	});

	describe('AccountsRepository', () => {
		describe('constructor()', () => {
			it('should assign param and data members properly', () => {
				expect(db.accounts.db).to.be.eql(db);
				expect(db.accounts.pgp).to.be.eql(db.$config.pgp);
				expect(db.accounts.dbTable).to.be.eql('mem_accounts');

				expect(db.accounts.dbFields).to.an('array');
				expect(db.accounts.dbFields).to.have.lengthOf(30);

				expect(db.accounts.cs).to.an('object');
				expect(db.accounts.cs).to.not.empty;
				expect(db.accounts.cs).to.have.all.keys(['select', 'insert', 'update']);
			});
		});

		describe('getDBFields()', () => {
			it('should return all db fields', () => {
				const dbFields = db.accounts.getDBFields();

				expect(dbFields).to.not.empty;
				expect(dbFields).to.have.lengthOf(db.accounts.dbFields.length);
			});
		});

		describe('getImmutableFields()', () => {
			it('should return only immutable account fields', () => {
				const immutableFields = db.accounts.getImmutableFields();

				expect(immutableFields).to.eql(['address', 'virgin']);
			});
		});

		describe('countMemAccounts()', () => {
			it('should use the correct SQL to fetch the count', function*() {
				sinonSandbox.spy(db, 'one');
				yield db.accounts.countMemAccounts();

				expect(db.one.firstCall.args[0]).to.eql(accountsSQL.countMemAccounts);
			});

			it('should pass no params to the SQL file', function*() {
				sinonSandbox.spy(db, 'one');
				yield db.accounts.countMemAccounts();

				expect(db.one.firstCall.args[1]).to.eql([]);
			});

			it('should execute only one query', function*() {
				sinonSandbox.spy(db, 'one');
				yield db.accounts.countMemAccounts();

				expect(db.one.calledOnce).to.be.true;
			});

			it('should parse the db output and return the integer count', function*() {
				sinonSandbox.stub(db, 'one').resolves({ count: '1' });

				const count = yield db.accounts.countMemAccounts();

				expect(count).to.eql(1);
			});

			it('should throw error if something wrong in the SQL execution', () => {
				sinonSandbox.stub(db, 'one').rejects();

				return expect(db.accounts.countMemAccounts()).to.be.rejected;
			});
		});

		describe('updateMemAccounts()', () => {
			it('should use the correct SQL to fetch the count', function*() {
				sinonSandbox.spy(db, 'query');
				yield db.accounts.updateMemAccounts();

				expect(db.query.firstCall.args[0]).to.eql(
					accountsSQL.updateMemAccounts
				);
			});

			it('should pass no params to the SQL file', function*() {
				sinonSandbox.spy(db, 'query');
				yield db.accounts.updateMemAccounts();

				expect(db.query.firstCall.args[1]).to.eql(undefined);
			});

			it('should execute only one query', function*() {
				sinonSandbox.spy(db, 'query');
				yield db.accounts.updateMemAccounts();

				expect(db.query.calledOnce).to.be.true;
			});

			it('should throw error if something wrong in the SQL execution', () => {
				sinonSandbox.stub(db, 'query').rejects();

				return expect(db.accounts.updateMemAccounts()).to.be.rejected;
			});

			it('should update all db.accounts which have different unconfirmed state for u_isDelegate', function*() {
				yield db.query(
					'UPDATE mem_accounts SET "isDelegate" = 1, "u_isDelegate" = 0'
				);
				yield db.accounts.updateMemAccounts();
				const result = yield db.one(
					'SELECT count(*) FROM mem_accounts WHERE "isDelegate" <> "u_isDelegate"'
				);

				expect(result.count).to.be.equal('0');
			});

			it('should update all db.accounts which have different unconfirmed state for u_secondSignature', function*() {
				yield db.query(
					'UPDATE mem_accounts SET "secondSignature" = 1, "u_secondSignature" = 0'
				);
				yield db.accounts.updateMemAccounts();
				const result = yield db.one(
					'SELECT count(*) FROM mem_accounts WHERE "secondSignature" <> "u_secondSignature"'
				);

				expect(result.count).to.be.equal('0');
			});

			it('should update all db.accounts which have different unconfirmed state for u_username', function*() {
				yield db.accounts.updateMemAccounts();
				const result = yield db.one(
					'SELECT count(*) FROM mem_accounts WHERE "username" <> "u_username"'
				);

				expect(result.count).to.be.equal('0');
			});

			it('should update all db.accounts which have different unconfirmed state for u_balance', function*() {
				yield db.query(
					'UPDATE mem_accounts SET "balance" = 123, "u_balance" = 124'
				);
				yield db.accounts.updateMemAccounts();
				const result = yield db.one(
					'SELECT count(*) FROM mem_accounts WHERE "balance" <> "u_balance"'
				);

				expect(result.count).to.be.equal('0');
			});

			it('should update all db.accounts which have different unconfirmed state for u_delegates', function*() {
				yield db.query(
					'UPDATE mem_accounts SET "delegates" = \'Alpha\', "u_delegates" = \'Beta\' '
				);
				yield db.accounts.updateMemAccounts();
				const result = yield db.one(
					'SELECT count(*) FROM mem_accounts WHERE "delegates" <> "u_delegates"'
				);

				expect(result.count).to.be.equal('0');
			});

			it('should update all db.accounts which have different unconfirmed state for u_multisignatures', function*() {
				yield db.query(
					'UPDATE mem_accounts SET "multisignatures" = \'Alpha\', "u_multisignatures" = \'Beta\' '
				);
				yield db.accounts.updateMemAccounts();
				const result = yield db.one(
					'SELECT count(*) FROM mem_accounts WHERE "multisignatures" <> "u_multisignatures"'
				);

				expect(result.count).to.be.equal('0');
			});

			it('should update all db.accounts which have different unconfirmed state for u_multimin', function*() {
				yield db.query(
					'UPDATE mem_accounts SET "multimin" = 1, "u_multimin" = 0'
				);
				yield db.accounts.updateMemAccounts();
				const result = yield db.one(
					'SELECT count(*) FROM mem_accounts WHERE "multimin" <> "u_multimin"'
				);

				expect(result.count).to.be.equal('0');
			});

			it('should update all db.accounts which have different unconfirmed state for u_multilifetime', function*() {
				yield db.query(
					'UPDATE mem_accounts SET "multilifetime" = 1, "u_multilifetime" = 0'
				);
				yield db.accounts.updateMemAccounts();
				const result = yield db.one(
					'SELECT count(*) FROM mem_accounts WHERE "multilifetime" <> "u_multilifetime"'
				);

				expect(result.count).to.be.equal('0');
			});
		});

		describe('getOrphanedMemAccounts()', () => {
			it('should use the correct SQL', function*() {
				sinonSandbox.spy(db, 'any');
				yield db.accounts.getOrphanedMemAccounts();

				expect(db.any.firstCall.args[0]).to.eql(
					accountsSQL.getOrphanedMemAccounts
				);
			});

			it('should yield orphan db.accounts if associated blockId does not exist', function*() {
				const firstAccount = (yield db.accounts.list({}, ['address']))[0];

				//  Make an orphan account
				yield db.none(
					`UPDATE mem_accounts SET "blockId" = 'unknownId' WHERE address = '${
						firstAccount.address
					}'`
				);

				const orphanAccounts = yield db.accounts.getOrphanedMemAccounts();
				const totalAccounts = yield db.one(
					'SELECT count(*)::int FROM mem_accounts'
				);

				// Check there are some accounts to test
				expect(totalAccounts.count).to.above(0);

				expect(orphanAccounts).to.lengthOf(1);
				expect(orphanAccounts[0].address).to.eql(firstAccount.address);
			});

			it('should yield orphan db.accounts with address, blockId and id attribute', function*() {
				//  Make an orphan account
				yield db.none('UPDATE mem_accounts SET "blockId" = \'unknownId\'');

				const orphanAccounts = yield db.accounts.getOrphanedMemAccounts();

				expect(orphanAccounts).to.lengthOf.above(0);

				orphanAccounts.forEach(orphanAccount => {
					expect(orphanAccount).to.have.all.keys('address', 'blockId', 'id');
				});
			});
		});

		describe('getDelegates()', () => {
			let delegateAccount;

			beforeEach(function*() {
				delegateAccount = accountFixtures.Account({ isDelegate: true });
				yield db.accounts.insert(delegateAccount);
			});

			it('should use the correct SQL', function*() {
				sinonSandbox.spy(db, 'any');
				yield db.accounts.getDelegates();

				expect(db.any.firstCall.args[0]).to.eql(accountsSQL.getDelegates);
			});

			it('should return db.accounts with isDelegate set to true ', function*() {
				const delegates = yield db.accounts.getDelegates();

				// Check there are some accounts to test
				expect(delegates).to.lengthOf(1);
				expect(delegates[0].publicKey).to.eql(delegateAccount.publicKey);
			});

			it('should only return "publicKey" of delegate db.accounts', function*() {
				const delegates = yield db.accounts.getDelegates();

				delegates.forEach(delegate => {
					expect(delegate).to.have.all.keys('publicKey');
				});
			});
		});

		describe('upsert()', () => {
			it('should throw error if no conflict field is specified', done => {
				const account = accountFixtures.Account();

				db.accounts
					.upsert(account)
					.then(value => {
						done(value);
					})
					.catch(error => {
						expect(error.message).to.be.eql(
							'Error: db.accounts.upsert - invalid conflictingFields argument'
						);
						done();
					});
			});

			it('should throw error if unknown field is provided to data or updateData', () => {
				return expect(
					db.accounts.upsert({ address: '12L' }, 'address', {
						unknownField: 'myValue',
					})
				).to.eventually.rejectedWith(
					'Unknown field provided to db.accounts.upsert'
				);
			});

			it('should succeed with null', () => {
				const account = accountFixtures.Account();

				return db.accounts.upsert(account, 'address').then(result => {
					expect(result).to.be.undefined;
				});
			});

			it('should insert account if conflictField="address" not found', () => {
				const account = accountFixtures.Account();

				return db.accounts.upsert(account, 'address').then(() => {
					return db.accounts.list({ address: account.address }).then(result => {
						expect(result.length).to.be.eql(1);
						expect(account).to.be.eql(_.omit(result[0], 'rank'));
					});
				});
			});

			it('should update account if conflictField="address" found', () => {
				const account1 = accountFixtures.Account();
				const account2 = accountFixtures.Account();

				// Since DB trigger protects from updating username only if it was null before
				delete account1.username;
				delete account1.u_username;

				account2.address = account1.address;

				return db.accounts.upsert(account1, 'address').then(() => {
					return db.accounts.upsert(account2, 'address').then(() => {
						return db.accounts
							.list({ address: account2.address })
							.then(result => {
								expect(result.length).to.be.eql(1);

								expect(result[0]).to.not.be.eql(account1);

								const omittedFields = db.accounts.getImmutableFields();
								omittedFields.push('rank');

								expect(_.omit(result[0], omittedFields)).to.be.eql(
									_.omit(account2, omittedFields)
								);
							});
					});
				});
			});

			it('should insert only the columns specified in columnSet.insert', () => {
				const account = accountFixtures.Account({
					delegates: [randomstring.generate(10).toLowerCase()],
				});

				return db.accounts.upsert(account, 'address').then(() => {
					return db.accounts.list({ address: account.address }).then(result => {
						expect(result.length).to.eql(1);
						expect(result[0].delegates).to.be.null;
					});
				});
			});

			it('should update only the columns specified in columnSet.update', () => {
				const originalAccount = accountFixtures.Account();
				const updatedAccount = accountFixtures.Account();

				// Since DB trigger protects from updating username only if it was null before
				delete originalAccount.username;
				delete originalAccount.u_username;

				return db.accounts.upsert(originalAccount, 'address').then(() => {
					return db.accounts
						.upsert(originalAccount, 'address', updatedAccount)
						.then(() => {
							return db.accounts
								.list({ address: originalAccount.address })
								.then(result => {
									expect(result.length).to.eql(1);

									const immutableFields = db.accounts.getImmutableFields();

									Object.keys(_.omit(result[0], 'rank')).forEach(field => {
										if (immutableFields.indexOf(field) !== -1) {
											// If it's an immutable field
											expect(result[0][field], field).to.eql(
												originalAccount[field]
											);
										} else {
											// If it's not an immutable field
											expect(result[0][field], field).to.eql(
												updatedAccount[field]
											);
										}
									});
								});
						});
				});
			});

			it('should update data attributes specified as "data" if argument "updateData" is missing', () => {
				const originalAccount = accountFixtures.Account();
				const updatedAccount = accountFixtures.Account();

				// Since DB trigger protects from updating username only if it was null before
				delete originalAccount.username;
				delete originalAccount.u_username;

				updatedAccount.address = originalAccount.address;

				return db.accounts.upsert(originalAccount, 'address').then(() => {
					return db.accounts.upsert(updatedAccount, 'address').then(() => {
						return db.accounts
							.list({ address: originalAccount.address })
							.then(result => {
								expect(result.length).to.eql(1);

								const immutableFields = db.accounts.getImmutableFields();

								Object.keys(_.omit(result[0], 'rank')).forEach(field => {
									if (immutableFields.indexOf(field) !== -1) {
										// If it's an immutable field
										expect(result[0][field], field).to.eql(
											originalAccount[field]
										);
									} else {
										// If it's not an immutable field
										expect(result[0][field], field).to.eql(
											updatedAccount[field]
										);
									}
								});
							});
					});
				});
			});

			it('should match the values for conflict keys case sensitively', () => {
				const originalAccount = accountFixtures.Account();
				const updatedAccount = accountFixtures.Account({
					username: originalAccount.username.toUpperCase(),
				});

				return db.accounts.upsert(originalAccount, 'username').then(() => {
					return db.accounts.upsert(updatedAccount, 'username').then(() => {
						return db.accounts
							.list({ username: updatedAccount.username })
							.then(result => {
								expect(result.length).to.eql(1);

								expect(_.omit(result[0], 'rank')).to.eql(updatedAccount);
							});
					});
				});
			});

			it('should match the multiple conflict keys with AND composite', () => {
				const originalAccount = accountFixtures.Account({
					u_username: 'alpha',
				});
				const updatedAccount = accountFixtures.Account({
					username: originalAccount.username,
					u_username: originalAccount.u_username,
				});

				return db.accounts.upsert(originalAccount, 'address').then(() => {
					return db.accounts
						.upsert(updatedAccount, ['username', 'u_username'])
						.then(() => {
							return db.accounts
								.list({ username: updatedAccount.username })
								.then(result => {
									expect(result.length).to.eql(1);

									expect(result[0].address).to.eql(originalAccount.address);
								});
						});
				});
			});
		});

		describe('insert()', () => {
			it('should insert account without any error', () => {
				const account = accountFixtures.Account();

				return db.accounts.insert(account);
			});

			it('should succeed with null', () => {
				const account = accountFixtures.Account();

				return db.accounts.insert(account).then(result => {
					expect(result).to.be.null;
				});
			});

			it('should insert all columns specified in db.accounts.cs.insert', () => {
				const account = accountFixtures.Account();

				return db.accounts.insert(account).then(() => {
					return db.accounts.list({ address: account.address }).then(result => {
						db.accounts.cs.insert.columns.forEach(column => {
							expect(result.length).to.eql(1);

							expect(result[0][column.prop || column.name]).to.eql(
								account[column.prop || column.name]
							);
						});
					});
				});
			});

			it('should not throw error when any unknown attribute is passed', () => {
				const account = accountFixtures.Account();
				account.unknownColumn = 'unnownValue';

				return db.accounts.insert(account);
			});
		});

		describe('update()', () => {
			it('should update account without any error', () => {
				const account = accountFixtures.Account();

				return db.accounts.insert(account).then(() => {
					return db.accounts.update(account.address, account);
				});
			});

			it('should succeed with null', () => {
				const account = accountFixtures.Account();
				const updateAccount = accountFixtures.Account();

				return db.accounts.insert(account).then(() => {
					return db.accounts
						.update(account.address, updateAccount)
						.then(result => {
							expect(result).to.be.null;
						});
				});
			});

			it('should throw error if called without an address', () => {
				const account = accountFixtures.Account();

				return expect(db.accounts.update(null, account)).to.be.rejectedWith(
					'Error: db.accounts.update - invalid address argument'
				);
			});

			it('should resolve to promise without any error if no data is passed', () => {
				return expect(db.accounts.update('12L', {})).to.eventually.fulfilled;
			});

			it('should update all columns specified in db.accounts.cs.update', () => {
				const account = accountFixtures.Account();
				const updateAccount = accountFixtures.Account();

				// Since DB trigger protects from updating username only if it was null before
				delete account.username;
				delete account.u_username;

				return db.accounts.insert(account).then(() => {
					return db.accounts.update(account.address, updateAccount).then(() => {
						return db.accounts
							.list({ address: account.address })
							.then(result => {
								db.accounts.cs.update.columns.forEach(column => {
									expect(result.length).to.eql(1);

									expect(result[0][column.prop || column.name]).to.eql(
										updateAccount[column.prop || column.name]
									);
								});
							});
					});
				});
			});

			it('should not throw error when any unknown attribute is passed', () => {
				const account = accountFixtures.Account();
				const updateAccount = accountFixtures.Account();

				updateAccount.unkownAttr = 'unknownAttr';

				return db.accounts.insert(account).then(() => {
					return db.accounts.update(account.address, updateAccount);
				});
			});
		});

		describe('increment()', () => {
			it('should use the correct SQL', function*() {
				sinonSandbox.spy(db, 'none');
				yield db.accounts.increment('12L', 'balance', 123);

				expect(db.none.firstCall.args[0]).to.eql(accountsSQL.incrementAccount);
			});

			it('should increment account attribute', function*() {
				const account = accountFixtures.Account();
				account.balance = 15000;

				yield db.accounts.insert(account);
				yield db.accounts.increment(account.address, 'balance', 1000);

				const updatedAccount = (yield db.accounts.list(
					{ address: account.address },
					['balance']
				))[0];

				expect(updatedAccount.balance).to.eql('16000');
			});

			it('should throw error if unknown field is provided', function*() {
				yield expect(db.accounts.increment('12L', 'unknown', 1000)).to
					.eventually.rejected;
			});
		});

		describe('decrement()', () => {
			it('should use the correct SQL', function*() {
				sinonSandbox.spy(db, 'none');
				yield db.accounts.decrement('12L', 'balance', 123);

				expect(db.none.firstCall.args[0]).to.eql(accountsSQL.decrementAccount);
			});

			it('should decrement account attribute', function*() {
				const account = accountFixtures.Account();
				account.balance = 15000;

				yield db.accounts.insert(account);
				yield db.accounts.decrement(account.address, 'balance', 1000);

				const updatedAccount = (yield db.accounts.list(
					{ address: account.address },
					['balance']
				))[0];

				expect(updatedAccount.balance).to.eql('14000');
			});

			it('should throw error if unknown field is provided', function*() {
				yield expect(db.accounts.decrement('12L', 'unknown', 1000)).to
					.eventually.rejected;
			});
		});

		describe('remove()', () => {
			it('should remove an existing account', function*() {
				const account = (yield db.accounts.list({}, ['address'], {
					limit: 1,
				}))[0];

				yield db.accounts.remove(account.address);

				const result = yield db.accounts.list({ address: account.address }, [
					'address',
				]);

				expect(result).to.be.empty;
			});
		});

		describe('resetMemTables()', () => {
			it('should use the correct SQL', function*() {
				sinonSandbox.spy(db, 'none');
				yield db.accounts.resetMemTables();

				expect(db.none.firstCall.args[0]).to.eql(accountsSQL.resetMemoryTables);
			});

			it('should process without any error', () => {
				return db.accounts.resetMemTables();
			});

			it('should empty the table "mem_round"', () => {
				return db.accounts
					.resetMemTables()
					.then(() => {
						return db.one('SELECT COUNT(*)::int AS count FROM mem_round');
					})
					.then(row => {
						expect(row.count).to.equal(0);
					});
			});

			it('should empty the table "mem_accounts2delegates"', () => {
				return db.accounts
					.resetMemTables()
					.then(() => {
						return db.one(
							'SELECT COUNT(*)::int AS count FROM mem_accounts2delegates'
						);
					})
					.then(row => {
						expect(row.count).to.equal(0);
					});
			});

			it('should empty the table "mem_accounts2u_delegates"', () => {
				return db.accounts
					.resetMemTables()
					.then(() => {
						return db.one(
							'SELECT COUNT(*)::int AS count FROM mem_accounts2u_delegates'
						);
					})
					.then(row => {
						expect(row.count).to.equal(0);
					});
			});

			it('should empty the table "mem_accounts2multisignatures"', () => {
				return db.accounts
					.resetMemTables()
					.then(() => {
						return db.one(
							'SELECT COUNT(*)::int AS count FROM mem_accounts2multisignatures'
						);
					})
					.then(row => {
						expect(row.count).to.equal(0);
					});
			});

			it('should empty the table "mem_accounts2u_multisignatures"', () => {
				return db.accounts
					.resetMemTables()
					.then(() => {
						return db.one(
							'SELECT COUNT(*)::int AS count FROM mem_accounts2u_multisignatures'
						);
					})
					.then(row => {
						expect(row.count).to.equal(0);
					});
			});
		});

		describe('list()', () => {
			before(() => {
				return createAccount().then(account => {
					validAccount = account;
				});
			});

			it('should return data without any error', () => {
				return db.accounts.list();
			});

			describe('fields', () => {
				it('should return all table fields if no field is specified', () => {
					return db.accounts.list().then(data => {
						const columnNames = _.map(db.accounts.cs.select.columns, column => {
							return column.prop || column.name;
						});

						expect(data[0]).to.have.all.keys(columnNames);
					});
				});

				it('should return only "address" if fields specify ["address"]', () => {
					return db.accounts.list({}, ['address']).then(data => {
						data.forEach(account => {
							expect(account).to.have.all.keys(['address']);
						});
					});
				});

				it('should return only "address" and "isDelegate" if fields specify ["address", "isDelegate"]', () => {
					return db.accounts.list({}, ['address', 'isDelegate']).then(data => {
						data.forEach(account => {
							expect(account).to.have.all.keys(['isDelegate', 'address']);
						});
					});
				});

				it('should skip any unknown field specified ["address", "unKnownField"]', () => {
					return db.accounts
						.list({}, ['address', 'unKnownField'])
						.then(data => {
							data.forEach(account => {
								expect(account).to.have.all.keys(['address']);
							});
						});
				});

				describe('property names', () => {
					it('should return "producedBlocks" column if "producedBlocks" is asked', () => {
						let actualResult;

						return db.accounts.list({}, ['producedBlocks']).then(data => {
							actualResult = data;

							return db
								.query(
									'SELECT producedblocks::bigint AS "producedBlocks" FROM mem_accounts'
								)
								.then(result => {
									expect(actualResult).to.eql(result);
								});
						});
					});

					it('should return "missedBlocks" column if "missedBlocks" is asked', () => {
						let actualResult;

						return db.accounts.list({}, ['missedBlocks']).then(data => {
							actualResult = data;

							return db
								.query(
									'SELECT missedblocks::bigint AS "missedBlocks" FROM mem_accounts'
								)
								.then(result => {
									expect(actualResult).to.eql(result);
								});
						});
					});
				});

				describe('dynamic fields', () => {
					it('should fetch "rank" based on query \'(SELECT m.row_number FROM (SELECT row_number() OVER (ORDER BY r."vote" DESC, r."publicKey" ASC), address FROM (SELECT d."isDelegate", d.vote, d."publicKey", d.address FROM mem_accounts AS d WHERE d."isDelegate" = 1) AS r) m WHERE m."address" = "mem_accounts"."address")::int\'', () => {
						let actualResult;

						return db.accounts.list({}, ['rank']).then(data => {
							actualResult = data;

							return db
								.query(
									'SELECT (SELECT m.row_number FROM (SELECT row_number() OVER (ORDER BY r."vote" DESC, r."publicKey" ASC), address FROM (SELECT d."isDelegate", d.vote, d."publicKey", d.address FROM mem_accounts AS d WHERE d."isDelegate" = 1) AS r) m WHERE m."address" = "mem_accounts"."address")::bigint AS rank FROM mem_accounts'
								)
								.then(result => {
									expect(actualResult).to.eql(result);
								});
						});
					});

					it('should fetch "delegates" based on query (SELECT ARRAY_AGG("dependentId") FROM mem_accounts2delegates WHERE "accountId" = "mem_accounts"."address")', () => {
						return db.accounts.list({}, ['address', 'delegates']).then(data => {
							return Promise.map(data, account => {
								return db
									.one(
										`SELECT (ARRAY_AGG("dependentId")) AS "delegates" FROM mem_accounts2delegates WHERE "accountId" = '${
											account.address
										}'`
									)
									.then(result => {
										expect(account.delegates).to.be.eql(result.delegates);
									});
							});
						});
					});

					it('should fetch "u_delegates" based on query (SELECT ARRAY_AGG("dependentId") FROM mem_accounts2u_delegates WHERE "accountId" = "mem_accounts"."address")', () => {
						return db.accounts
							.list({}, ['address', 'u_delegates'])
							.then(data => {
								return Promise.map(data, account => {
									return db
										.one(
											`SELECT (ARRAY_AGG("dependentId")) AS "u_delegates" FROM mem_accounts2u_delegates WHERE "accountId" = '${
												account.address
											}'`
										)
										.then(result => {
											expect(account.u_delegates).to.be.eql(result.u_delegates);
										});
								});
							});
					});

					it('should fetch "multisignatures" based on query (SELECT ARRAY_AGG("dependentId") FROM mem_accounts2multisignatures WHERE "accountId" = "mem_accounts"."address")', () => {
						return db.accounts
							.list({}, ['address', 'multisignatures'])
							.then(data => {
								return Promise.map(data, account => {
									return db
										.one(
											`SELECT (ARRAY_AGG("dependentId")) AS "multisignatures" FROM mem_accounts2multisignatures WHERE "accountId" = '${
												account.address
											}'`
										)
										.then(result => {
											expect(account.multisignatures).to.be.eql(
												result.multisignatures
											);
										});
								});
							});
					});

					it('should fetch "u_multisignatures" based on query (SELECT ARRAY_AGG("dependentId") FROM mem_accounts2u_multisignatures WHERE "accountId" = "mem_accounts"."address")', () => {
						return db.accounts
							.list({}, ['address', 'u_multisignatures'])
							.then(data => {
								return Promise.map(data, account => {
									return db
										.one(
											`SELECT (ARRAY_AGG("dependentId")) AS "u_multisignatures" FROM mem_accounts2u_multisignatures WHERE "accountId" = '${
												account.address
											}'`
										)
										.then(result => {
											expect(account.u_multisignatures).to.be.eql(
												result.u_multisignatures
											);
										});
								});
							});
					});
				});

				describe('data casting', () => {
					it('should return "isDelegate" as "boolean"', () => {
						return db.accounts
							.list({}, ['isDelegate'], { limit: 1 })
							.then(data => {
								expect(data[0].isDelegate).to.be.a('boolean');
							});
					});

					it('should return "u_isDelegate" as "boolean"', () => {
						return db.accounts
							.list({}, ['u_isDelegate'], { limit: 1 })
							.then(data => {
								expect(data[0].u_isDelegate).to.be.a('boolean');
							});
					});

					it('should return "secondSignature" as "boolean"', () => {
						return db.accounts
							.list({}, ['secondSignature'], { limit: 1 })
							.then(data => {
								expect(data[0].secondSignature).to.be.a('boolean');
							});
					});

					it('should return "u_secondSignature" as "boolean"', () => {
						return db.accounts
							.list({}, ['u_secondSignature'], { limit: 1 })
							.then(data => {
								expect(data[0].u_secondSignature).to.be.a('boolean');
							});
					});

					it('should return "balance" as "bigint"', () => {
						return db.accounts
							.list({}, ['balance'], { limit: 1 })
							.then(data => {
								expect(data[0].balance).to.be.a('string');
							});
					});

					it('should return "u_balance" as "bigint"', () => {
						return db.accounts
							.list({}, ['u_balance'], { limit: 1 })
							.then(data => {
								expect(data[0].u_balance).to.be.a('string');
							});
					});

					it('should return "rate" as "bigint"', () => {
						return db.accounts.list({}, ['rate'], { limit: 1 }).then(data => {
							expect(data[0].rate).to.be.a('string');
						});
					});

					it('should return "fees" as "bigint"', () => {
						return db.accounts.list({}, ['fees'], { limit: 1 }).then(data => {
							expect(data[0].fees).to.be.a('string');
						});
					});

					it('should return "rewards" as "bigint"', () => {
						return db.accounts
							.list({}, ['rewards'], { limit: 1 })
							.then(data => {
								expect(data[0].rewards).to.be.a('string');
							});
					});

					it('should return "vote" as "bigint"', () => {
						return db.accounts.list({}, ['vote'], { limit: 1 }).then(data => {
							expect(data[0].vote).to.be.a('string');
						});
					});

					it('should return "producedBlocks" as "bigint"', () => {
						return db.accounts
							.list({}, ['producedBlocks'], { limit: 1 })
							.then(data => {
								expect(data[0].producedBlocks).to.be.a('string');
							});
					});

					it('should return "missedBlocks" as "bigint"', () => {
						return db.accounts
							.list({}, ['missedBlocks'], { limit: 1 })
							.then(data => {
								expect(data[0].missedBlocks).to.be.a('string');
							});
					});

					it('should return "virgin" as "boolean"', () => {
						return db.accounts.list({}, ['virgin'], { limit: 1 }).then(data => {
							expect(data[0].virgin).to.be.a('boolean');
						});
					});
				});

				describe('functions', () => {
					it('should always return "address" as "upper(address)"', () => {
						return db.accounts.list({}, ['address']).then(data => {
							data.forEach(account => {
								expect(account.address).to.eql(account.address.toUpperCase());
							});
						});
					});

					it('should always return "publicKey" as "encode(publicKey, \'hex\')"', () => {
						return db.accounts.list({}, ['publicKey']).then(data => {
							data.forEach(account => {
								expect(account.publicKey).to.be.a('string');
							});
						});
					});

					it('should always return "secondPublicKey" as "encode(secondPublicKey, \'hex\')"', () => {
						return db.accounts.list({}, ['secondPublicKey']).then(data => {
							data.forEach(account => {
								if (account.secondPublicKey) {
									expect(account.secondPublicKey).to.be.a('string');
								}
							});
						});
					});
				});
			});

			describe('filters', () => {
				it('should return a multisig account if filter.multisig is provided', function*() {
					const account = accountFixtures.Account();
					account.multimin = 1;

					yield db.accounts.insert(account);
					const accounts = yield db.accounts.list({ multisig: true });

					expect(accounts).to.lengthOf(1);
					expect(accounts[0].address).to.eql(account.address);
				});

				it('should return a multiple accounts if filter.address is provided as array', function*() {
					const account1 = accountFixtures.Account();
					const account2 = accountFixtures.Account();

					yield db.accounts.insert(account1);
					yield db.accounts.insert(account2);
					const accounts = yield db.accounts.list({
						address: [account1.address, account2.address],
					});

					expect(accounts).to.lengthOf(2);
					expect(accounts[0].address).to.eql(account1.address);
					expect(accounts[1].address).to.eql(account2.address);
				});

				it('should return valid result if filter.username is provided', () => {
					return db.accounts
						.list({ username: validAccount.username })
						.then(data => {
							data.forEach(account => {
								expect(account.username).to.be.eql(validAccount.username);
							});
						});
				});

				it('should return valid result if filter.username is provided with $like object', function*() {
					const account1 = accountFixtures.Account({ username: 'AlphaBravo' });
					const account2 = accountFixtures.Account({
						username: 'BravoCharlie',
					});

					yield db.accounts.insert(account1);
					yield db.accounts.insert(account2);

					const accounts = yield db.accounts.list({
						username: { $like: '%Bravo%' },
					});

					expect(accounts).to.lengthOf(2);
					expect(accounts[0].address).to.eql(account1.address);
					expect(accounts[1].address).to.eql(account2.address);
				});

				it('should return valid result with composite conditions if filter.username AND filter.address is provided', () => {
					return db.accounts
						.list({
							username: validAccount.username,
							address: validAccount.address,
						})
						.then(data => {
							data.forEach(account => {
								expect(account.username).to.be.eql(validAccount.username);
								expect(account.address).to.be.eql(validAccount.address);
							});
						});
				});

				it('should throw error if unknown field is provided as filter', () => {
					return expect(
						db.accounts.list({
							username: validAccount.username,
							unknownField: 'Alpha',
						})
					).to.be.rejectedWith('Unknown filter field provided to list');
				});
			});

			describe('options', () => {
				describe('sort', () => {
					it('should sort by address in descending if options.sortField="address"', () => {
						return db.accounts
							.list({}, ['address'], { sortField: 'address', limit: 10 })
							.then(data => {
								const actualData = _.map(data, 'address');

								expect(actualData).to.be.eql(_(actualData).dbSort('desc'));
							});
					});

					it('should sort by address in ascending if options.sortField="address" and options.sortMethod="ASC"', () => {
						return db.accounts
							.list({}, ['address'], {
								sortField: 'address',
								sortMethod: 'ASC',
								limit: 10,
							})
							.then(data => {
								const actualData = _.map(data, 'address');

								expect(actualData).to.be.eql(_(actualData).dbSort('asc'));
							});
					});

					it('should sort by username in ascending if options.sortField="username" and options.sortMethod="ASC"', () => {
						return db.accounts
							.list({}, ['address'], {
								sortField: 'username',
								sortMethod: 'ASC',
								limit: 10,
							})
							.then(data => {
								const actualData = _.map(data, 'username');

								expect(actualData).to.be.eql(_(actualData).dbSort('asc'));
							});
					});

					it('should sort by multiple keys if sortField and sortField is provided as array', function*() {
						const accounts = yield db.accounts.list(
							{},
							['address', 'username'],
							{
								sortField: ['username', 'address'],
								sortMethod: ['DESC', 'ASC'],
							}
						);

						const sortedAccounts = _.orderBy(
							Object.assign({}, accounts),
							['username', 'address'],
							['desc', 'asc']
						);

						expect(accounts).to.lengthOf.above(0);
						expect(accounts).to.eql(sortedAccounts);
					});

					it('should fail if unknown sort field is specified', () => {
						return expect(
							db.accounts.list({}, ['address'], {
								sortField: 'unknownField',
								limit: 10,
							})
						).to.be.rejectedWith('column "unknownField" does not exist');
					});
				});

				describe('extraCondition', () => {
					it('should use additional SQL condition if options.extraCondition is provided', function*() {
						const account = accountFixtures.Account({
							username: 'AlphaBravo',
						});

						yield db.accounts.insert(account);

						const accounts = yield db.accounts.list({}, ['address'], {
							extraCondition: `"username" = 'AlphaBravo' AND "blockId" = '${
								account.blockId
							}'`,
						});

						expect(accounts).to.lengthOf(1);
						expect(accounts[0].address).to.eql(account.address);
					});
				});

				describe('limit & offset', () => {
					it('should return all results if no limit is specified', () => {
						let count;

						return db.accounts.list({}, ['address']).then(data => {
							count = data.length;

							return db
								.one('SELECT COUNT(*)::int as count from mem_accounts')
								.then(result => {
									expect(result.count).to.be.equal(count);
								});
						});
					});

					it('should return 1 result if options.limit=1', () => {
						return db.accounts
							.list({}, ['address'], { limit: 1 })
							.then(data => {
								expect(data.length).to.be.equal(1);
							});
					});

					it('should skip first result if options.offset=1', () => {
						let previousData;

						return db.accounts
							.list({}, ['address'], { limit: 2 })
							.then(data => {
								previousData = data;
								return db.accounts.list({}, ['address'], {
									limit: 1,
									offset: 1,
								});
							})
							.then(data => {
								expect(previousData.length).to.eql(2);
								expect(data.length).to.eql(1);
								expect(data[0]).to.eql(previousData[1]);
							});
					});
				});
			});
		});

		describe('removeDependencies()', () => {
			it('should use the correct SQL', function*() {
				sinonSandbox.spy(db, 'none');
				yield db.accounts.removeDependencies('12L', '12345', 'delegates');

				expect(db.none.firstCall.args[0]).to.eql(
					accountsSQL.removeAccountDependencies
				);
			});

			it('should throw error if wrong dependency is passed', () => {
				return expect(
					db.accounts.removeDependencies('12L', '12345', 'unknown')
				).to.eventually.rejectedWith(
					'Error: db.accounts.removeDependencies called with invalid argument dependency=unknown'
				);
			});

			[
				'delegates',
				'u_delegates',
				'multisignatures',
				'u_multisignatures',
			].forEach(dependentTable => {
				it(`should remove dependent account from ${dependentTable}`, function*() {
					const accounts = yield db.accounts.list(
						{},
						['address', 'publicKey'],
						{ limit: 2 }
					);

					yield db.query(
						db.$config.pgp.helpers.insert(
							{
								accountId: accounts[0].address,
								dependentId: accounts[1].publicKey,
							},
							null,
							{ table: `mem_accounts2${dependentTable}` }
						)
					);

					const before = yield db.one(
						`SELECT count(*) from mem_accounts2${dependentTable}`
					);
					yield db.accounts.removeDependencies(
						accounts[0].address,
						accounts[1].publicKey,
						dependentTable
					);
					const after = yield db.one(
						`SELECT count(*) from mem_accounts2${dependentTable}`
					);

					expect(before.count).to.eql('1');
					expect(after.count).to.eql('0');
				});
			});
		});

		describe('insertDependencies()', () => {
			it('should throw error if wrong dependency is passed', () => {
				return expect(
					db.accounts.insertDependencies('12L', '12345', 'unknown')
				).to.eventually.rejectedWith(
					'Error: db.accounts.insertDependencies called with invalid argument dependency=unknown'
				);
			});

			[
				'delegates',
				'u_delegates',
				'multisignatures',
				'u_multisignatures',
			].forEach(dependentTable => {
				it(`should insert dependent account from ${dependentTable}`, function*() {
					const accounts = yield db.accounts.list(
						{},
						['address', 'publicKey'],
						{ limit: 2 }
					);

					const before = yield db.one(
						`SELECT count(*) from mem_accounts2${dependentTable}`
					);
					yield db.accounts.insertDependencies(
						accounts[0].address,
						accounts[1].publicKey,
						dependentTable
					);
					const after = yield db.one(
						`SELECT count(*) from mem_accounts2${dependentTable}`
					);

					expect(before.count).to.eql('0');
					expect(after.count).to.eql('1');
				});
			});
		});

		describe('convertToNonVirgin()', () => {
			it('should use the correct SQL', function*() {
				const account = accountFixtures.Account();
				yield db.accounts.insert(account);

				sinonSandbox.spy(db, 'none');
				yield db.accounts.convertToNonVirgin(account.address);
				expect(db.none.firstCall.args[0]).to.eql(
					accountsSQL.convertToNonVirgin
				);
			});

			it('should convert a virgin account to a non virgin account', function*() {
				const account = accountFixtures.Account();
				let result = null;

				yield db.accounts.insert(account);
				result = yield db.accounts.list({ address: account.address });

				expect(result[0].address).to.eql(account.address);
				expect(result[0].virgin).to.eql(true);

				yield db.accounts.convertToNonVirgin(account.address);
				result = yield db.accounts.list({ address: account.address });
				expect(result[0].address).to.eql(account.address);
				expect(result[0].virgin).to.eql(false);
			});
		});
	});
});