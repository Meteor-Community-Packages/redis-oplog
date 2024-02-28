/* eslint-env mocha */

import { assert } from 'chai'
import { Campaigns } from './collections'
import { subscribeAsync } from '../lib/helpers'
import { Meteor } from 'meteor/meteor'

describe('Polling', function() {
  it('Should work!', async function() {
    await Meteor.callAsync('campaign_search_reset')
    const pollingIntervalMs = 100
    const handle = await subscribeAsync(
      'campaign_search',
      'John',
      pollingIntervalMs)

    try {
      const results = await Campaigns.find().fetchAsync()

      assert.lengthOf(results, 2)

      await Meteor.callAsync('campaign_search_insert', {
        text: 'John Broman',
      })

      await new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            const results = await Campaigns.find().fetchAsync()
            assert.lengthOf(results, 3)

            resolve()
          } catch (e) {
            reject(e)
          }
        }, pollingIntervalMs + 100)
      })

    } finally {
      handle.stop()
    }

  })
})

