Package.describe({
    name: 'cultofcoders:redis-oplog',
    version: '3.0.0',
    // Brief, one-line summary of the package.
    summary: 'Replacement for Meteor\'s MongoDB oplog implementation',
    // URL to the Git repository containing the source code for this package.
    git: 'https://github.com/cult-of-coders/redis-oplog',
    // By default, Meteor will default to using README.md for documentation.
    // To avoid submitting documentation, set this field to null.
    documentation: 'README.md',
});

Npm.depends({
    redis: '3.1.2',
    'deep-extend': '0.6.0',
    'lodash.clonedeep': '4.5.0',
});

Package.onUse((api) => {
    api.versionsFrom(['2.15', '3.0.1', '3.1']);
    api.use([
        'underscore',
        'ecmascript',
        'ejson',
        'minimongo',
        'mongo',
        'random',
        'ddp-server',
        'diff-sequence',
        'id-map',
        'mongo-id',
        'tracker',
    ]);

    api.mainModule('redis-oplog.js', 'server');
    api.mainModule('redis-oplog.client.js', 'client');
});

Package.onTest((api) => {
    api.use('cultofcoders:redis-oplog');

    // extensions
    api.use('aldeed:collection2@4.0.4');
    api.use('reywood:publish-composite@1.8.12');
    api.use('natestrauser:publish-performant-counts@0.1.2');
    // api.use('socialize:user-presence@1.0.4');

    api.use('ecmascript');
    api.use('tracker');
    api.use('mongo');
    api.use('random');
    api.use('accounts-password');
    api.use("matb33:collection-hooks@2.0.0-rc.5");
    api.use("alanning:roles@4.0.0");
    api.use('ddp-server');

    api.use(['meteortesting:mocha']);

    api.mainModule('testing/main.server.js', 'server');
    api.addFiles('testing/publishComposite/boot.js', 'server');
    api.addFiles('testing/optimistic-ui/boot.js', 'server');

    api.mainModule('testing/main.client.js', 'client');
});
