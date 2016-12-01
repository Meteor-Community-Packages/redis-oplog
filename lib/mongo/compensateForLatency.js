import RedisSubscriptionManager from '../redis/RedisSubscriptionManager';
import syntheticProcessor from '../processors/synthetic';
import { Strategy } from '../constants';
import containsOperators from './lib/containsOperators';

/**
 * Latency compensator acts exactly as a synthetic event, which is very quick
 *
 * @param channels
 * @param event
 * @param doc
 */
export default (channels, event, doc) => {
    channels.forEach(channel => {
        var subscribers = RedisSubscriptionManager.store[channel];
        if (subscribers) {
            subscribers.forEach(subscriber => {
                if (subscriber.strategy !== Strategy.LIMIT_SORT) {
                    // we may have shared processors and limit_sort is not reliable
                    syntheticProcessor(subscriber.observableCollection, event, doc)
                }
            })
        }
    })
}