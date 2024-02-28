import { AsyncLocalStorage } from 'async_hooks';

class OptimisticInvocation {
    constructor() {
        this.context = new AsyncLocalStorage();
    }

    get() {
        return this.context.getStore();
    }

    withValue(value, fn) {
        return this.context.run(value, () => fn());
    }
}

const optimisticInvocation = new OptimisticInvocation;
// const optimisticInvocation = new Meteor.EnvironmentVariable();

export default optimisticInvocation;
