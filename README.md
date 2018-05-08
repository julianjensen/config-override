Configuration File System
=========================

[![Greenkeeper badge](https://badges.greenkeeper.io/julianjensen/config-override.svg)](https://greenkeeper.io/)

Not ready for primetime yet. No unit tests. Inspired by `rc` and `acm`, both great but I needed some of both.

For the following examples, I'm assuming we're calling the program `RESTAPI`.

To set a configuration value using an environment variable:
* `export RESTAPI_DEMO_CONNECTION_HOST=192.168.1.16`
  
  Translates to `OPTIONS.demo.connection.host = '192.168.1.16'`

* `export RESTAPI_DEMO_CONNECTION_PORT=27017`
  
  Translates to `OPTIONS.demo.connection.port = 27017`

In the end you end up with the following overrides:
```
{
    demo: {
        connection: {
            host: '192.168.1.16',
            port: 27017
        }
    } 
}
```

For setting a single value using `RESTAPI`. Notice that both `'_'` and `'.'` work here:
* `export RESTAPI=demo_connection_host=192.168.1.16`
* `export RESTAPI=demo.connection.port=27017`

Or via the command line:
`--restapi.demo.connection.host=192.168.1.16`

Usage
-----
Simply create the instance.
```
const
     config = new Configuration( 'restapi', { hello: "World", more: { say: "Hi, dude!" } } ),
     options = cfg.get();

console.log( 'All my options merged:', options );
console.log( 'Where did we look?', cfg.diagnostics );
```
For example, if (on Windows) you have a couple of config files in your path:

In the current directory we have `.restapirc`
```
{
    "local": {
        "options": {
            "go": "here",
            "boolean": false
        }
    }
}
```
and in your home directory you make, for example, `restapi.json`
```
{
    "from": {
        "myhome": [ "first", "second" ]
    }
}
```
and then run the following command (_config-test.js_ is not a real app, just an example. Substitute an actual app):
```
set RESTAPI_WEE_VALUES=things && set RESTAPI=some.server.elsewhere=192.168.1.16 && node config-test.js --restapi.custom.demo.connection.host=192.168.1.16 --restapi.custom.how.about.two=question
```
we get the following config
```
{ 
     hello: 'World',
     more: { 
         say: 'Hi dude!' 
     },
     from: { 
         myhome: [ 'first', 'second' ] 
     },
     local: { 
         options: { 
             go: 'here', 
             boolean: false 
         } 
     },
     some: { 
         server: { 
             elsewhere: '192.168.1.16' 
         } 
     },
     wee: { 
         values: 'things' 
     },
     custom: { 
         demo: { 
             connection: { 
                 host: '192.168.1.16' 
             } 
         },
         how: { 
             about: { 
                 two: 'question' 
             } 
         } 
     } 
 }
```
If you leave out `appName`, it will get the application name from the `package.json` belonging to the top module of the current app.

Configuration values are read in the following order, later reads overwrite ealier ones, so the first step as the lowest priority as it can
get overwritten by any of the later steps.
1. Default configuration
2. Configuration files read from `/etc`
3. Configuration files read from `$HOME`
4. Configuration files read from `process.cwd()`
5. Configuration files read from `process.cwd()` and checking everywhere up to the root
6. Environment variables
7. Command line argunments
8. Internal overrides applied by the code

In the list above, whenever it says "Configuration files read from" it actually tries a number of variations, trying to locate a config file. Basically, it tries all the combinations listed below.
1. Check location for `.config/<APPNAME>/config`
2. Check for variations: `.config/<APPNAME>/config.json`, `.config/<APPNAME>/config.json5`, `.config/<APPNAME>/config.ini`, `.config/<APPNAME>/config.yml`, `.config/<APPNAME>/config.yaml`
3. Check location for `.config/<APPNAME>`
4. Check for variations: `.config/<APPNAME>.json`, `.config/<APPNAME>.json5`, `.config/<APPNAME>.ini`, `.config/<APPNAME>.yml`, `.config/<APPNAME>.yaml`
5. Check location for `.<APPNAME>/config`
6. Check for variations: `.<APPNAME>/config.json`, `.<APPNAME>/config.json5`, `.<APPNAME>/config.ini`, `.<APPNAME>/config.yml`, `.<APPNAME>/config.yaml`
7. Check location for `.<APPNAME>rc`
8. Check for variations: `.<APPNAME>rc.json`, `.<APPNAME>rc.json5`, `.<APPNAME>rc.ini`, `.<APPNAME>rc.yml`, `.<APPNAME>rc.yaml`
9. Check location for `<APPNAME>`
10. Check for variations: `<APPNAME>.json`, `<APPNAME>.json5`, `<APPNAME>.ini`, `<APPNAME>.yml`, `<APPNAME>.yaml`

To see the complete list, look at the `diagnostics` field of the `Configuration` class. There you can find the entire list of all the files it checked for, as well as the files actually loaded. 
