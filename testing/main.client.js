/* eslint-env mocha */

import { assert } from 'chai'
import { Collections, config } from './boot'
import { _ } from 'meteor/underscore'
import './synthetic_mutators'
import './client_side_mutators'
import './publishComposite/client.test'
import './optimistic-ui/client.test'
import './transformations/client'
import './publish-counts/client'
import './custom-publications/client'
import './collection-defaults/client'
import './vent/client'
import './accounts/client'
import './polling/client'
import './object-id/client'
import { Random } from 'meteor/random'
import helperGenerator from './lib/helpers'

_.each(Collections, (Collection, key) => {
  const {
    createAsync,
    updateAsync,
    removeAsync,
    upsertAsync,
    subscribe,
    waitForHandleToBeReady,
  } = helperGenerator(config[key].suffix)

  describe('It should work with: ' + key, function() {
/*    before(async function() {
      await Collection.find().forEach(async doc => {
        await removeAsync({ _id: doc._id })
      });
    })*/

    it('Should detect a removal', function(done) {
      try {
        const handle = subscribe(
          {
            game: 'chess',
          },
          {
            sort: { score: -1 },
            limit: 5,
          },
        )

        const randomTitle = Random.id()
        const cursor = Collection.find()
        let _id

        const observeChangesHandle = cursor.observeChanges({
          added(docId, doc) {
            if (doc.title === randomTitle) {
              removeAsync({ _id: docId })
            }
          },
          removed(docId) {
            assert.equal(docId, _id)
            observeChangesHandle.stop()
            handle.stop()
            done()
          },
        })

        waitForHandleToBeReady(handle).then(function() {
          createAsync({ game: 'chess', title: randomTitle })
            .then(async function(id) {
              _id = id
            })
        })
      } catch (e) {
        console.error(e)
        done(e)
      }
    })

    it('Should detect an insert', function(done) {
      const handle = subscribe(
        {
          game: 'chess',
        },
        {
          sort: { score: -1 },
          limit: 5,
        },
      )

      const cursor = Collection.find({ game: 'chess' })

      const observeChangesHandle = cursor.observeChanges({
        added(docId, doc) {
          if (doc.title === 'E') {
            observeChangesHandle.stop()
            handle.stop()
            removeAsync({ _id: docId })
              .then(() => done())
              .catch(done)
          }
        },
      })

      waitForHandleToBeReady(handle)
        .then(function() {
          const data = cursor.fetch()

          assert.lengthOf(data, 3)

          createAsync({
            game: 'chess',
            title: 'E',
          })
        })
        .catch(done)
    })

    it('Should detect an update simple', function(done) {
      const handle = subscribe(
        {
          game: 'chess',
        },
        {
          sort: { score: -1 },
          limit: 5,
        },
      )

      const cursor = Collection.find()

      const observeChangesHandle = cursor.observeChanges({
        changed(docId) {
          observeChangesHandle.stop()
          handle.stop()
          done()
        },
      })

      waitForHandleToBeReady(handle)
        .then(async function() {
          const data = await cursor.fetchAsync()

          updateAsync(
            { _id: data[0]._id },
            {
              $set: {
                score: Math.random(),
              },
            },
          )
        })
        .catch(done)
    })

    it('Should detect an update deeply nested', function(done) {
      createAsync({
        game: 'chess',
        nested: {
          a: 1,
          b: 1,
          c: {
            a: 1,
          },
        },
      }).then(function(docId) {
        const handle = subscribe({ _id: docId })
        const cursor = Collection.find({ _id: docId })

        const observeChangesHandle = cursor.observeChanges({
          changed(docId, doc) {
            observeChangesHandle.stop()
            handle.stop()

            assert.equal(doc.nested.b, 2)
            assert.equal(doc.nested.a, 1)
            assert.equal(doc.nested.c.b, 1)
            assert.equal(doc.nested.c.a, 1)
            assert.equal(doc.nested.d, 1)
            assert.lengthOf(Object.keys(doc), 1)
            assert.lengthOf(Object.keys(doc.nested), 4)

            removeAsync({ _id: docId }).then(() => {
              done()
            })
          },
        })

        waitForHandleToBeReady(handle)
          .then(function() {
            return updateAsync(
              { _id: docId },
              {
                $set: {
                  'nested.c.b': 1,
                  'nested.b': 2,
                  'nested.d': 1,
                },
              },
            )
          })
          .catch(done)
      })
    })

    it('Should not update multiple documents if not specified (multi:true)', function(done) {
      const context = Random.id()
      createAsync([
        { context, game: 'monopoly', title: 'test' },
        { context, game: 'monopoly', title: 'test2' },
      ]).then(function([_id1, _id2]) {
        const handle = subscribe({ game: 'monopoly' })
        waitForHandleToBeReady(handle).then(function() {
          const cursor = Collection.find({ _id: { $in: [_id1, _id2] } })

          const observeChangesHandle = cursor.observeChanges({
            changed(docId) {
              assert.equal(docId, _id1)
              observeChangesHandle.stop()
              handle.stop()

              removeAsync({ context, game: 'monopoly' })
                .then(() => done())
            },
          })

          updateAsync(
            { context, game: 'monopoly' },
            { $set: { score: Math.random() } },
          )
        })
      })
    })

    it('Should update multiple documents if specified', function(done) {
      const context = 'multi-update'
      createAsync([
        { context, title: 'test' },
        { context, title: 'test2' },
      ]).then(function([_id1, _id2]) {
        const handle = subscribe({ context })
        waitForHandleToBeReady(handle).then(function() {
          const cursor = Collection.find({ context })

          let changes = 0
          const observeChangesHandle = cursor.observeChanges({
            changed(docId) {
              changes += 1

              if (changes === 2) {
                observeChangesHandle.stop()
                handle.stop()
                done()
              }
            },
          })

          updateAsync(
            { context },
            {
              $set: { score: Math.random() },
            },
            { multi: true },
          )
        })
      })
    })

    it('Should detect an update of a non published document', function(done) {
      createAsync({
        game: 'backgammon',
        title: 'test',
      }).then(function(_id) {
        const handle = subscribe({
          game: 'chess',
        })

        const score = Math.random()
        const cursor = Collection.find()

        const observeChangesHandle = cursor.observeChanges({
          added(docId, doc) {
            if (docId !== _id) return

            assert.equal(doc.game, 'chess')
            assert.equal(doc.score, score)
            assert.equal(doc.title, 'test')

            observeChangesHandle.stop()
            handle.stop()
            removeAsync({ _id }).then(() => done())
          },
        })

        waitForHandleToBeReady(handle).then(() => updateAsync({ _id }, { $set: { game: 'chess', score } }))
          .catch(done)
      })
    })

    it('Should detect an update of a nested field when fields is specified', function(done) {
      createAsync({
        roles: {
          _groups: ['company1', 'company2', 'company3'],
          _main: 'company1',
          _global: {
            roles: ['manage-users', 'manage-profiles'],
          },
        },
      }).then(function(_id) {
        const handle = subscribe(
          {},
          {
            fields: { roles: 1 },
          },
        )

        const cursor = Collection.find()
        const observeChangesHandle = cursor.observeChanges({
          changed(docId, doc) {
            assert.equal(docId, _id)
            handle.stop()
            observeChangesHandle.stop()
            removeAsync({ _id })
              .then(() => done())
          },
        })

        waitForHandleToBeReady(handle)
          .then(() => updateAsync({ _id }, { $set: { 'roles._main': 'company2' } }))
          .catch(done)
      })
    })

    it('Should update properly a nested field when a positional parameter is used', function(done) {
      const context = 'positional-paramter'

      createAsync({
        context,
        bom: [
          {
            stockId: 1,
            quantity: 1,
          },
          {
            stockId: 2,
            quantity: 2,
          },
          {
            stockId: 3,
            quantity: 3,
          },
        ],
      }).then(function(_id) {
        const handle = subscribe(
          { context },
          {
            fields: {
              context: 1,
              bom: 1,
            },
          },
        )

        const cursor = Collection.find({ context })
        const observeChangesHandle = cursor.observeChanges({
          changed(docId, doc) {
            assert.equal(docId, _id)
            doc.bom.forEach(element => {
              assert.isTrue(Object.keys(element).length === 2)
              if (element.stockId === 1) {
                assert.equal(element.quantity, 30)
              } else {
                assert.equal(element.quantity, element.stockId)
              }
            })
            handle.stop()
            observeChangesHandle.stop()
            removeAsync({ _id }).then(() => done())
          },
        })

        waitForHandleToBeReady(handle)
          .then(() => updateAsync({ _id, 'bom.stockId': 1 }, {
            $set: { 'bom.$.quantity': 30 },
          }))
          .catch(done)
      })
    });


    ['server'].forEach(context => {
      it('Should work with $and operators: ' + context, function(done) {
        createAsync({
          orgid: '1',
          siteIds: ['1', '2'],
          Year: 2017,
        }).then(function(_id) {
          const handle = subscribe({
            $and: [
              {
                orgid: '1',
              },
              {
                siteIds: { $in: ['1'] },
              },
              {
                Year: { $in: [2017] },
              },
            ],
          })

          waitForHandleToBeReady(handle)
            .then(function() {
              const cursor = Collection.find()
              let inChangedEvent = false
              const observeChangesHandle = cursor.observeChanges({
                changed(docId, doc) {
                  assert.equal(docId, _id)
                  inChangedEvent = true
                  // assert.equal(doc.something, 30);
                  updateAsync({ _id }, { $set: { Year: 2018 } })
                },
                removed(docId) {
                  assert.isTrue(inChangedEvent)
                  assert.equal(docId, _id)

                  handle.stop()
                  observeChangesHandle.stop()
                  done()
                },
              })

              updateAsync(
                { _id },
                {
                  $set: {
                    something: 30,
                  },
                },
              )
            })
            .catch(done)
        })
      })
    })

    it('Should be able to detect subsequent updates for direct processing with _ids', function(done) {
      createAsync([
        { subsequent_test: true, name: 'John Smith' },
        { subsequent_test: true, name: 'Michael Willow' },
      ]).then(function([_id1, _id2]) {
        const handle = subscribe(
          { _id: { $in: [_id1, _id2] } },
          {
            fields: { subsequent_test: 1, name: 1 },
          },
        )

        const cursor = Collection.find({ subsequent_test: true })
        let inFirst = false

        const observer = cursor.observeChanges({
          changed(docId, doc) {
            if (docId === _id1) {
              inFirst = true
              assert.equal('John Smithy', doc.name)
            }
            if (docId === _id2) {
              assert.isTrue(inFirst)
              assert.equal('Michael Willowy', doc.name)
              handle.stop()
              observer.stop()
              done()
            }
          },
        })

        waitForHandleToBeReady(handle)
          .then(function() {
            updateAsync(_id1, {
              $set: { name: 'John Smithy' },
            }).then(function() {
              updateAsync(_id2, {
                $set: { name: 'Michael Willowy' },
              })
            })
          })
          .catch(done)
      })
    })

    it('Should work with the $addToSet', function(done) {
      createAsync({
        operators: true,
        connections: [1, 2],
        number: 10,
      }).then(function(_id) {
        const handle = subscribe({ _id })
        const cursor = Collection.find({ _id })

        waitForHandleToBeReady(handle)
          .then(function() {
            const observer = cursor.observeChanges({
              changed(docId, doc) {
                assert.equal(docId, _id)
                assert.lengthOf(doc.connections, 3)

                observer.stop()
                handle.stop()
                done()
              },
            })

            updateAsync(
              { _id },
              {
                $addToSet: {
                  connections: 3,
                },
              },
            )
          })
          .catch(done)
      })
    })

    it('Should work with the $pull', function(done) {
      createAsync({
        operators: true,
        connections: [1, 2],
        number: 10,
      }).then(function(_id) {
        const handle = subscribe({ _id })
        const cursor = Collection.find({ _id })

        waitForHandleToBeReady(handle)
          .then(function() {
            const observer = cursor.observeChanges({
              changed(docId, doc) {
                assert.equal(docId, _id)
                assert.lengthOf(doc.connections, 1)

                observer.stop()
                handle.stop()
                done()
              },
            })

            updateAsync(
              { _id },
              {
                $pull: {
                  connections: 2,
                },
              },
            )
          })
          .catch(done)
      })
    })

    it('Should work with nested field updates', function(done) {
      createAsync({
        profile: {
          language: 'EN',
          email: 'xxx@xxx.com',
          number: 5,
        },
      }).then(function(_id) {
        const handle = subscribe({ _id })
        const cursor = Collection.find({ _id })

        waitForHandleToBeReady(handle)
          .then(function() {
            const observer = cursor.observeChanges({
              changed(docId, doc) {
                assert.equal(docId, _id)
                assert.equal(doc.profile.number, 10)
                const fullDoc = Collection.findOne(docId)
                assert.equal(fullDoc.profile.language, 'EN')
                assert.equal(fullDoc.profile.email, 'xxx@xxx.com')

                observer.stop()
                handle.stop()
                done()
              },
            })

            updateAsync(_id, {
              $set: {
                'profile.number': 10,
              },
            })
          })
          .catch(done)
      })
    })

    it('Should work with the $pull and $set in combination', function(done) {
      createAsync({
        test_pull_and_set_combo: true,
        connections: [1],
        number: 10,
      }).then(function(_id) {
        const handle = subscribe({ test_pull_and_set_combo: true })
        const cursor = Collection.find(
          {
            _id: {
              $in: [_id],
            },
          },
          {
            fields: {
              connections: 1,
              number: 1,
            },
          },
        )

        waitForHandleToBeReady(handle)
          .then(function() {
            const observer = cursor.observeChanges({
              changed(docId, doc) {
                assert.equal(docId, _id)
                assert.equal(doc.number, 20)
                assert.lengthOf(doc.connections, 0)

                observer.stop()
                handle.stop()
                done()
              },
            })

            updateAsync(_id, {
              $pull: {
                connections: { $in: [1] },
              },
              $set: {
                number: 20,
              },
            })
          })
          .catch(done)
      })
    })

    it('Should work properly with limit-sort kind of queries', function(done) {
      const context = 'limit-sort-test'
      const limit = 5
      removeAsync({ context }).then(function() {
        createAsync([
          { context, number: 5, text: 'T - 1' },
          { context, number: 10, text: 'T - 2' },
          { context, number: 15, text: 'T - 3' },
          { context, number: 20, text: 'T - 4' },
          { context, number: 25, text: 'T - 5' },
          { context, number: -1, text: 'T - Last one' },
        ]).then(function(ids) {
          const [, _id2, _id3, , , _id6] = ids

          const handle = subscribe(
            {
              context,
            },
            {
              limit,
              sort: { number: -1 },
            },
          )

          waitForHandleToBeReady(handle)
            .then(function() {
              const cursor = Collection.find({ context })
              let inChanged = false
              let initialAddBlast = true
              const observer = cursor.observeChanges({
                changed(docId, doc) {
                  assert.equal(docId, _id2)
                  assert.equal(doc.number, 30)
                  inChanged = true
                },
                removed(docId) {
                  if (docId === _id3) {
                    assert.equal(docId, _id3)

                    // Now we will add it back!
                    updateAsync(
                      { _id: _id3 },
                      {
                        $set: { context },
                      },
                    )
                  }
                },
                added(docId, doc) {
                  if (initialAddBlast) {
                    return
                  }

                  if (docId === _id6) {
                    // console.log('id6 has been added bc id3 has been removed.');
                  } else {
                    // console.log('id3 should be added back');
                    assert.equal(docId, _id3)
                    assert.isTrue(inChanged)

                    observer.stop()
                    handle.stop()
                    done()
                  }
                },
              })

              initialAddBlast = false
              const data = cursor.fetch()

              assert.lengthOf(data, limit)

              // We make sure that the last element does not exist and is properly sorted.
              assert.isTrue(data.find(el => el._id === _id6) === undefined)
              // ids.forEach((_id, idx) => {
              //     assert.equal(data[limit - 1 - idx]._id, _id);
              // });

              updateAsync(
                { _id: _id2 },
                {
                  $set: { number: 30 },
                },
              )
              updateAsync(
                { _id: _id3 },
                {
                  $set: { context: 'limit-sort-test-invalidate' },
                },
              )
            })
            .catch(done)
        })
      })
    })

    it('Should work with _ids direct processing and other filters present', function(done) {
      const context = 'ids-process-test'
      createAsync([
        { context, meta: { student: false } },
        { context, meta: { student: true } },
        { context, meta: { student: true } },
      ]).then(function(ids) {
        const handle = subscribe({
          _id: { $in: ids },
          'meta.student': true,
        })

        waitForHandleToBeReady(handle)
          .then(async function() {
            const cursor = Collection.find({ context })
            const data = await cursor.fetchAsync()

            assert.lengthOf(data, 2)

            const observer = cursor.observeChanges({
              removed(docId) {
                assert.equal(docId, ids[0])

                observer.stop()
                handle.stop()
                done()
              },
              added(docId, doc) {
                if (docId === ids[0]) {
                  assert.equal(docId, ids[0])
                  updateAsync(ids[0], {
                    $set: { 'meta.changing': true },
                  })
                }
              },
              changed(docId, doc) {
                if (docId === ids[0]) {
                  updateAsync(ids[0], {
                    $set: { 'meta.student': false },
                  })
                }
              },
            })

            updateAsync(ids[0], {
              $set: { 'meta.student': true },
            })
          })
          .catch(done)
      })
    })

    it('Should detect an insert with the default processor', function(done) {
      const context = 'insert-default-processing' + Random.id()
      const handle = subscribe({ context })

      waitForHandleToBeReady(handle)
        .then(function() {
          const cursor = Collection.find({ context })

          const observer = cursor.observeChanges({
            added(docId, doc) {
              assert.equal(doc.context, context)
              setTimeout(() => {
                observer.stop()
                handle.stop()
                done()
              }, 50)
            },
          })

          createAsync({ context })
        })
        .catch(done)
    })

    it('Should detect an update with string publication that should be id', function(done) {
      const context = 'string-filters'
      createAsync({ context }).then(function(_id) {
        const handle = subscribe(_id)

        waitForHandleToBeReady(handle)
          .then(function() {
            const cursor = Collection.find({ context })

            const observer = cursor.observeChanges({
              changed(docId, doc) {
                assert.equal(docId, _id)
                assert.equal(doc.number, 10)
                observer.stop()
                handle.stop()
                done()
              },
            })

            updateAsync(_id, { $set: { number: 10 } })
          })
          .catch(done)
      })
    })

    it('Should work with deep nest specified fields', function(done) {
      const context = 'edge-case-001'

      createAsync({
        context,
        passengers: [],
      }).then(function(_id) {
        const handle = subscribe(_id, {
          fields: {
            context: 1,
            'passengers.name': 1,
          },
        })

        waitForHandleToBeReady(handle)
          .then(function() {
            const cursor = Collection.find({ context })
            const observer = cursor.observeChanges({
              changed(docId, doc) {
                assert.equal(docId, _id)
                assert.lengthOf(doc.passengers, 1)
                observer.stop()
                handle.stop()
                done()
              },
            })

            updateAsync(_id, {
              $addToSet: {
                passengers: {
                  _id: 'y2MECXDgr9ggiP5D4',
                  name: 'Marlee Nielsen',
                  phone: '',
                },
              },
            })
          })
          .catch(done)
      })
    })

    it('Should work with upsert', function(done) {
      const context = 'upsertion' + Random.id()
      const handle = subscribe({ context })

      waitForHandleToBeReady(handle)
        .then(function() {
          const cursor = Collection.find({ context })
          const observer = cursor.observeChanges({
            added(docId, doc) {
              assert.equal(doc.number, 10)
              upsertAsync(
                { context },
                {
                  $set: {
                    number: 20,
                  },
                },
              )
            },
            changed(docId, doc) {
              assert.equal(doc.number, 20)
              observer.stop()
              handle.stop()
              done()
            },
          })

          upsertAsync(
            { context },
            {
              context,
              number: 10,
            },
          )
        })
        .catch(done)
    })

    it('Should not detect a change if pushToRedis is false', function(done) {
      const context = 'pushToRedis:false'
      const handle = subscribe({ context })

      waitForHandleToBeReady(handle)
        .then(async function() {
          const cursor = Collection.find({ context })
          let _id
          const observer = await cursor.observeChanges({
            added(docId, doc) {
              if (docId === _id) {
                done('Should not be in added')
              }
            },
            changed(docId, doc) {
              if (docId === _id) {
                done('Should not be in changed')
              }
            },
            removed(docId) {
              if (docId === _id) {
                done('Should not be in changed')
              }
            },
          })

          createAsync(
            {
              context,
            },
            { pushToRedis: false },
          ).then(async function(id) {
            _id = id

            updateAsync(
              { _id },
              {
                $set: { number: 10 },
              },
              { pushToRedis: false })
              .then((res) => {
                removeAsync({ _id }, { pushToRedis: false })
              })
              .catch(done)

            setTimeout(() => {
              observer.stop()
              handle.stop()
              done()
            }, 200)
          })
            .catch(done)
        })
        .catch(done)
    })

    it('Should work correctly when disallowed fields are specified', function(done) {
      const context = 'disallowed-fields-' + Random.id()
      const handle = subscribe(
        { context },
        {
          fields: {
            profile: 0,
            'address.city': 0,
            fullname: 0,
          },
        },
      )

      waitForHandleToBeReady(handle)
        .then(function() {
          const cursor = Collection.find({ context })

          const observer = cursor.observeChanges({
            added(docId, doc) {
              if (doc.context !== context) return

              assert.equal(doc.other, 'Public')
              assert.isUndefined(doc.profile)
              assert.isObject(doc.address)
              assert.isString(doc.address.country)
              assert.isUndefined(doc.address.city)
              assert.isUndefined(doc.fullname)

              updateAsync(
                { _id: docId },
                {
                  $set: {
                    'address.country': 'Testing',
                    fullname: 'Testing',
                    other: 'Publico',
                    newField: 'public',
                    'profile.firstName': 'John',
                  },
                },
              )
            },
            changed(docId, doc) {
              assert.equal(doc.other, 'Publico')
              assert.isUndefined(doc.profile)
              assert.isObject(doc.address)
              assert.equal(doc.address.country, 'Testing')
              assert.equal(doc.newField, 'public')
              assert.isUndefined(doc.address.city)
              assert.isUndefined(doc.fullname)

              observer.stop()
              handle.stop()
              done()
            },
          })

          createAsync({
            context,
            profile: {
              name: 'Secret',
            },
            address: {
              country: 'Country',
              city: 'Secret',
            },
            fullname: 'Secret',
            other: 'Public',
          })
        })
        .catch(done)
    })

    it('Should work correctly with the allowed fields only specified', function(done) {
      const context = 'allowed-fields'
      const handle = subscribe(
        { context },
        {
          fields: {
            context: 1,
            profile: 1,
            'address.city': 1,
            fullname: 1,
          },
        },
      )

      waitForHandleToBeReady(handle)
        .then(function() {
          const cursor = Collection.find({ context })
          const observer = cursor.observeChanges({
            added(docId, doc) {
              assert.isUndefined(doc.other)
              assert.isObject(doc.profile)
              assert.isObject(doc.address)
              assert.isString(doc.address.city)
              assert.isUndefined(doc.address.country)
              assert.isString(doc.fullname)

              updateAsync(
                { _id: docId },
                {
                  $set: {
                    'address.country': 'Testing',
                    fullname: 'Testing',
                    other: 'secret',
                    newField: 'secret',
                    'profile.firstName': 'John',
                  },
                },
              )
            },
            changed(docId, doc) {
              assert.isUndefined(doc.other)
              assert.isObject(doc.profile)
              assert.equal(doc.profile.firstName, 'John')
              assert.isUndefined(doc.newField)
              assert.equal(doc.fullname, 'Testing')

              observer.stop()
              handle.stop()
              done()
            },
          })

          createAsync({
            context,
            profile: {
              name: 'Public',
            },
            address: {
              country: 'Country',
              city: 'Public',
            },
            fullname: 'Public',
            other: 'Secret',
          })
        })
        .catch(done)
    })

    it('Should work with limit-sort when only _id is specified', function(done) {
      const context = Random.id()
      const handle = subscribe(
        { context },
        {
          fields: {
            context: 1,
            _id: 1,
          },
          sort: { context: 1 },
          limit: 20,
        },
      )

      waitForHandleToBeReady(handle)
        .then(function() {
          const cursor = Collection.find({ context })
          const observer = cursor.observeChanges({
            added(docId, doc) {
              assert.isUndefined(doc.something)
              assert.isTrue(Object.keys(doc).length === 1)
              updateAsync(
                { _id: docId },
                {
                  $set: {
                    something: false,
                  },
                },
              )

              observer.stop()
              done()
            },
            changed(docId, doc) {
              observer.stop()
              done(
                'Should not be in changed event because nothing changed',
              )
            },
          })

          createAsync({
            context,
            something: true,
          })
        })
        .catch(done)
    })

    it('Should work properly with $unset', function(done) {
      const context = 'test-$unset'
      const handle = subscribe({ context })


      waitForHandleToBeReady(handle)
        .then(function() {
          const cursor = Collection.find({ context })

          let initialAdd = true
          const observer = cursor.observeChanges({
            added(docId, doc) {
              if(initialAdd) return;
              assert.isTrue(doc.something)

              setTimeout(() => {
                updateAsync(
                  { _id: docId },
                  {
                    $unset: {
                      something: '',
                    },
                  },
                )
              }, 50)
            },
            changed(docId, doc) {
              assert.isTrue('something' in doc)
              assert.isUndefined(doc.something)

              removeAsync({ _id: docId })
              observer.stop()
              handle.stop()
              done()
            },
          })
          initialAdd = false;

          createAsync({
            context,
            something: true,
          })
        })
        .catch(done)
    })

    it('Should work when updating deep array when it is specified as a field', function(done) {
      const context = `deep-array-objects-${Random.id()}`

      const handle = subscribe(
        { context },
        {
          fields: {
            context: 1,
            'deep.deep.array': 1,
          },
        },
      )

      waitForHandleToBeReady(handle)
        .then(function() {
          const cursor = Collection.find({ context })

          const observer = cursor.observeChanges({
            added(docId, doc) {
              assert.isArray(doc.deep.deep.array)
              assert.lengthOf(doc.deep.deep.array, 6)
              updateAsync(
                {
                  _id: docId,
                  'deep.deep.array': 6,
                },
                {
                  $set: {
                    'deep.deep.array.$': 20,
                  },
                },
              )
            },
            changed(docId, doc) {
              assert.isArray(doc.deep.deep.array)
              assert.lengthOf(doc.deep.deep.array, 6)
              doc.deep.deep.array.forEach(number => {
                assert.isNumber(number)
              })
              assert.isTrue(_.contains(doc.deep.deep.array, 20))

              observer.stop()
              handle.stop()
              done()
            },
          })

          createAsync({
            context,
            deep: {
              deep: {
                array: [1, 2, 3, 4, 5, 6],
              },
            },
          })
        })
        .catch(done)
    })

    it('Should work when updating a specific element in an array', function(done) {
      const context = 'update-specific-in-arrays'

      const handle = subscribe(
        { context },
        {
          fields: {
            context: 1,
            passengers: 1,
          },
        },
      )

      waitForHandleToBeReady(handle)
        .then(function() {
          const cursor = Collection.find({ context })

          const observer = cursor.observeChanges({
            added(docId, doc) {
              updateAsync(
                { _id: docId },
                {
                  $set: {
                    'passengers.1.phone': 'ZZZ',
                  },
                },
              )
            },
            changed(docId, doc) {
              doc.passengers.forEach(passenger => {
                if (passenger.previous === 'YYY') {
                  assert.equal(passenger.phone, 'ZZZ')
                  observer.stop()
                  handle.stop()
                  done()
                }
              })
            },
          })

          createAsync({
            context,
            passengers: [
              {
                previous: 'XXX',
                phone: 'XXX',
              },
              {
                previous: 'YYY',
                phone: 'YYY',
              },
            ],
          })
        })
        .catch(done)
    })

    it('Should work with $elemMatch query selector', function(done) {
      const context = 'work-with-elemMatch-' + Random.id()

      const handle = subscribe({
        context,
        emails: {
          $elemMatch: {
            address: 'x@x.com',
          },
        },
      })

      waitForHandleToBeReady(handle)
        .then(function() {
          const cursor = Collection.find({
            context,
          })

          const observer = cursor.observeChanges({
            added(docId, doc) {
              assert.isArray(doc.emails)
              assert.equal('x@x.com', doc.emails[0].address)
              handle.stop()
              observer.stop()
              done()
            },
          })

          createAsync({
            context,
            emails: [
              {
                address: 'x@x.com',
              },
            ],
          })
        })
        .catch(done)
    })

    it('Should detect 3rd level nesting changes', function(done) {
      const context = 'deep-level-nesting-' + Random.id()

      const handle = subscribe({
        context,
      })

      waitForHandleToBeReady(handle)
        .then(function() {
          const cursor = Collection.find({
            context,
          })

          const observer = cursor.observeChanges({
            added(docId, doc) {
              updateAsync(docId, {
                $set: {
                  'item.profile.name': 'Elena Smith',
                },
              })
            },
            changed(docId, doc) {
              assert.isObject(doc.item)
              assert.equal('Elena Smith', doc.item.profile.name)
              observer.stop()
              done()
            },
          })

          createAsync({
            context,
            item: {
              profile: {
                name: 'John Smith',
              },
            },
          })
        })
        .catch(done)
    })

    it('Should work with a filter on a subfield and a top field specified', function(done) {
      createAsync({
        master: {
          sub: 'TEST',
          sub2: 1,
          sub3: 1,
        },
      })
        .then(function(_id) {
          const handle = subscribe(
            {
              _id,
              'master.sub': 'TEST',
            },
            {
              fields: {
                master: 1,
              },
            },
          )

          waitForHandleToBeReady(handle).then(function() {
            const cursor = Collection.find({ _id })
            const document = Collection.findOne({ _id })
            assert.isObject(document.master)
            assert.equal(document.master.sub, 'TEST')
            assert.equal(document.master.sub2, 1)
            assert.equal(document.master.sub3, 1)

            const observeChangesHandle = cursor.observeChanges({
              changed(docId, doc) {
                assert.equal(doc.master.sub2, 2)
                handle.stop()
                observeChangesHandle.stop()
                done()
              },
            })

            updateAsync(
              { _id },
              {
                $set: { 'master.sub2': 2 },
              },
            )
          })
        })
        .catch(done)
    })
  })
})

