import { Meteor } from 'meteor/meteor'
import { waitForHandleToBeReady } from './sync_utils'

export default (suffix) => {
  const create = (...args) => {
    console.warn('create is deprecated, use createAsync instead')
    return Meteor.callAsync(`create.${suffix}`, ...args)
  }

  const createAsync = (...args) => {
    return Meteor.callAsync(`create.${suffix}`, ...args)
  }

  const fetch = (...args) => {
    console.warn('fetch is deprecated, use fetchAsync instead')
    Meteor.callAsync(`fetch.${suffix}`, ...args)
  }

  const fetchAsync = (...args) => {
    return Meteor.callAsync(`fetch.${suffix}`, ...args)
  }

  const remove = (...args) => {
    console.warn('remove is deprecated, use removeAsync instead')
    Meteor.callAsync(`remove.${suffix}`, ...args)
  }

  const removeAsync = (...args) => {
    return Meteor.callAsync(`remove.${suffix}`, ...args)
  }

  const update = (...args) => {
    console.warn('update is deprecated, use updateAsync instead')
    return Meteor.callAsync(`update.${suffix}`, ...args)
  }

  const updateAsync = (...args) => {
    return Meteor.callAsync(`update.${suffix}`, ...args)
  }

  const upsert = (...args) => {
    console.warn('upsert is deprecated, use upsertAsync instead')
    return Meteor.callAsync(`upsert.${suffix}`, ...args)
  }

  const upsertAsync = (...args) => {
    return Meteor.callAsync(`upsert.${suffix}`, ...args)
  }

  const synthetic = (...args) => {
    console.warn('synthetic is deprecated, use syntheticAsync instead')
    return Meteor.callAsync(`synthetic.${suffix}`, ...args)
  }

  const syntheticAsync = (...args) => {
    return Meteor.callAsync(`synthetic.${suffix}`, ...args)
  }

  const subscribe = (...args) => {
    return Meteor.subscribe(`publication.${suffix}`, ...args)
  }

  export const subscribeAsync = (methodName,...args) => {
    return new Promise((resolve) => {
      const handle = Meteor.subscribe(methodName, ...args, function () {
        resolve.call(this,this)
      })
    });
  }

  return {
    createAsync,
    updateAsync,
    upsertAsync,
    fetchAsync,
    removeAsync,
    subscribe,
    syntheticAsync,
    waitForHandleToBeReady,
  }
}
