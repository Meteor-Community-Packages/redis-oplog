import { Mongo } from 'meteor/mongo'
import { Meteor } from 'meteor/meteor'

const Campaigns = new Mongo.Collection('campaign_searches')

if (Meteor.isServer) {
  Campaigns.createIndexAsync({
    text: 'text'
  }).catch(err => {
    console.error(err)
  })
}

export { Campaigns }
