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

const DBSandbox = require('../../../common/db_sandbox').DBSandbox;
const forksFixtures = require('../../../fixtures').forks;
const delegatesSQL = require('../../../../db/sql').delegates;
const seeder = require('../../../common/db_seed');

let db;
let dbSandbox;

describe('db', () => {
	before(done => {
		dbSandbox = new DBSandbox(
			__testContext.config.db,
			'lisk_test_db_delegates'
		);

		dbSandbox.create((err, __db) => {
			db = __db;

			done(err);
		});
	});

	after(done => {
		dbSandbox.destroy();
		done();
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

	it('should initialize db.delegates repo', () => {
		return expect(db.delegates).to.be.not.null;
	});

	describe('DelegatesRepository', () => {
		describe('constructor()', () => {
			it('should assign param and data members properly', () => {
				expect(db.delegates.db).to.be.eql(db);
				return expect(db.accounts.pgp).to.be.eql(db.$config.pgp);
			});
		});

		describe('insertFork()', () => {
			it('should use the correct SQL with given params', function*() {
				sinonSandbox.spy(db, 'none');
				const fork = new forksFixtures.Fork();
				yield db.delegates.insertFork(fork);

				expect(db.none.firstCall.args[0]).to.eql(delegatesSQL.insertFork);
				return expect(db.none.firstCall.args[1]).to.eql(fork);
			});

			it('should insert valid fork entry successfully', function*() {
				const fork = new forksFixtures.Fork();
				yield db.delegates.insertFork(fork);

				const result = yield db.query('SELECT * from forks_stat');

				expect(result).to.be.not.empty;
				expect(result).to.have.lengthOf(1);
				expect(result[0]).to.have.all.keys(
					'delegatePublicKey',
					'blockTimestamp',
					'blockId',
					'blockHeight',
					'previousBlock',
					'cause'
				);
				expect(
					Buffer.from(result[0].delegatePublicKey, 'hex').toString()
				).to.be.eql(fork.delegatePublicKey);
				expect(result[0].blockId).to.be.eql(fork.blockId);
				expect(result[0].blockHeight).to.be.eql(fork.blockHeight);
				expect(result[0].previousBlock).to.be.eql(fork.previousBlock);
				expect(result[0].blockTimestamp).to.be.eql(fork.blockTimestamp);
				return expect(result[0].cause).to.be.eql(fork.cause);
			});

			const fork = new forksFixtures.Fork();
			Object.keys(fork).forEach(attr => {
				const params = Object.assign({}, fork);
				delete params[attr];

				it(`should be rejected with error if param "${attr}" is missing`, () => {
					return expect(
						db.delegates.insertFork(params)
					).to.be.eventually.rejectedWith(`Property '${attr}' doesn't exist.`);
				});
			});
		});
	});
});
