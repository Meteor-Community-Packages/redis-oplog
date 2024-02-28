import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'

const waitForHandleToBeReady = handle => {
  return new Promise((resolve) => {
    Tracker.autorun(c => {
      if (handle.ready()) {
        c.stop()

        resolve()
      }
    })
  })
}

export { waitForHandleToBeReady }
