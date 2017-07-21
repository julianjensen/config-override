/** ****************************************************************************************************
 *
 * A configuration file reader that looks in several places for relevantly named files, also
 * adds command line options and environment variables. For files, it accepts several different formats.
 *
 * File: index.js
 * @author Julian Jensen <julian@exploreplanet3.com> on 17-AUG-2016
 * @version 0.0.1
 *******************************************************************************************************/
'use strict';
// @formatter:off

const
    path = require( 'path' ),
    os = require( 'os' ),
    fs = require( 'fs' ),
    util = require( 'util' ),
    fread = util.promisify( fs.readFile ),
    fstat = util.promisify( fs.stat ),
    readfile = ( fn, enc = 'utf8' ) => fs.readFileSync( fn, enc ),
    lazy = require( 'require-lazy-loader' ),
    lc = str => str.toLowerCase(),
    rxNumber = /^\d+$/,

    /** @type {function(string):boolean} */
    exists = fn => {
        try {
            fs.statSync( fn );
            return true;
        }
        catch ( err ) {
            return false;
        }
    },
    parsers = {
        ini: lazy( 'ini parse' ),
        conf: lazy( 'ini parse' ),
        json5: lazy( 'json5 parse' ),
        json: JSON.parse,
        yaml: lazy( 'yamljs parse' ),
        yml: lazy( 'yamljs parse' )
    },

    /** @type {function(object, string, value=):*} */
    _getset = function( obj, accessor, value ) {
        if ( !accessor ) return value;

        if ( !obj ) obj = {};

        const
            keys = accessor.split( '.' ).map( key => rxNumber.test( key ) ? +key : key );

        let ref = obj;

        keys.forEach( ( key, index ) => {

            if ( typeof ref[ key ] === 'undefined' )
                ref[ key ] = typeof keys[ index + 1 ] === 'number' ? [] : {};

            if ( index === keys.length - 1 && arguments.length === 3 )
                ref[ key ] = value;

            ref = ref[ key ];
        } );

        return arguments.length === 3 ? obj : ref;
    },

    defaultOptions = {
        delimiter: '_',
        hyphenSubstitute: '_',
        extensions: [ '', '.json', '.json5', '.ini', '.yml', '.yaml', 'conf' ]
    };

/**
 * @class Configuration
 */
class Configuration
{
    /**
     *  @param {?string} [appName]       - Defaults to the name from `package.json`
     *  @param {?object} [defaults={}]   - The default options
     */
    constructor( appName = null, defaults = {} )
    {
        this.opts = Object.assign( {}, defaultOptions, ( typeof defaults === 'object' && defaults._config ) || {} );

        if ( !Array.isArray( this.opts.extensions ) ) this.opts.extensions = this.opts.extensions ? [ this.opts.extensions ] : defaultOptions.extensions;

        // If we didn't get an app name, walk the module tree to find the top dog. npm is flat these days so this may be overkill, but...
        if ( !appName )
        {
            let _appName = module.parent;

            while ( _appName.parent && _appName.parent !== _appName ) _appName = _appName.parent;
            appName = require( path.relative( './', path.join( path.dirname( _appName.filename ), 'package.json' ) ) ).name;
        }

        this._diagnostics = [];

        this.appName = appName;
        this.keyAppName = lc( appName.replace( '-', this.opts.hyphenSubstitute ) );

        // Grab any app options set as an environment variable
        this.env = this.parse_env( process.env, this.opts.delimiter );

        // Grab command line options that are named after the app, i.e. --APPNAME=prop.key=value
        let cli = require( 'minimist' )( process.argv.slice( 2 ) );
        this.argv = cli[ this.keyAppName ] || {};

        this.defaults = typeof defaults === 'string' ? parsers.json5( defaults ) : defaults;

        this.overrides = {};

        this.configList = [];
        this.configFiles = [];
        this.cookedConfigFiles = [];

        this.add_files();

        this.merged = this.merge();
    }

    get diagnostics()
    {
        return {
            diagnostics: this._diagnostics,
            contributors: this.cookedConfigFiles
        };
    }

    /**
     * @param {string} key
     * @param {*} value
     */
    set( key, value )
    {
        this.merged = null;
        _getset( this.overrides, key, value );
    }

    /**
     * Get the final configuration object that includes all configuration files,
     * environment variables, and command line overrides.
     *
     * @return {object}
     */
    get()
    {
        return this.merged || ( this.merged = this.merge() );
    }

    /**
     * @return {object}
     */
    merge()
    {
        return Object.assign( {}, this.defaults, ...this.configList, this.env, this.argv, this.overrides );
    }

    /**
     * Look for key value pairs that look like either of these two:
     *
     * * ${APPNAME}_propkey[..._propkey]=<value>
     * * ${APPNAME}=propkey[..._propkey]=<value>
     *
     * These examples show the default delimiter `"_"` which can be changed by setting DEFAULTS._config.delimiter
     * to some other character.
     *
     * @param {object} obj
     * @param {string} delim
     * @return {object}
     */
    parse_env( obj, delim = '_' )
    {
        const
            keyname = this.keyAppName,
            rxDelim = new RegExp( delim, 'g' );

        return Object.keys( obj )
            .reduce( ( envs, _key ) => {
                let key = lc( _key ),
                    value = obj[ _key ];

                if ( typeof value !== 'string' ) return envs;

                value = value.trim();

                if ( key === keyname )
                    [ key, value ] = value.split( '=' );
                else if ( key.startsWith( keyname + delim ) )
                    key = key.substr( keyname.length + 1 );
                else
                    return envs;

                if ( delim !== '.' ) key = key.replace( rxDelim, '.' );

                _getset( envs, key, rxNumber.test( value ) ? +value : value === 'true' ? true : value === 'false' ? false : value );

                return envs;
        }, {} );
    }

    /**
     * @param {Array<string>} parts
     * @return {Buffer}
     */
    get_file( ...parts )
    {
        let pathParts = parts.filter( p => !!p );

        if ( pathParts.some( pp => typeof pp !== 'string' ) ) return null;

        try {
            return readfile( path.join( ...pathParts ) );
        }
        catch ( err ) {
            return null;
        }
    }

    file_async( ...parts )
    {
        let pathParts = parts.filter( p => !!p );

        if ( pathParts.some( pp => typeof pp !== 'string' ) ) return null;

        const fileName = path.join( ...pathParts );

        this._diagnostics.push( fn );

        return fs.stat( fileName ).then( () => fread( fileName, 'utf8' ) ).catch( () => null );
    }

    add_config_async( file, findIt = false )
    {
        if ( ~this.configFiles.indexOf( file ) ) return;

        return Promise.all(
            this.opts.extensions
                .map( x => file + x )
                .map( filename => this.file_async( filename ).then( contents => this.parse( filename, contents ) ).catch( () => null ) )
        );

    }

    parse( filename, contents )
    {
            // console.trace( `filename: ${filename}, contents:`, filename );
        let extIndex = filename.lastIndexOf( '.' ),
            _parser;

        if ( extIndex > 0 )
            _parser = parsers[ lc( filename.substr( extIndex + 1 ) ) ];

        if ( !_parser )
            _parser = /^[\s\n]*{/m.test( contents ) ? parsers.json : parsers.ini;

        try {
            return _parser( contents );
        }
        catch ( err ) {
            return null;
        }
    }

    /**
     * @param {string} file
     * @param {boolean} findIt
     */
    add_config_file( file, findIt = false )
    {
        if ( ~this.configFiles.indexOf( file ) ) return;

        const
            filesToCheck = this.opts.extensions.map( x => file + x );

        let fileConfig;

        for ( let filename of filesToCheck )
        {
            if ( findIt )
                filename = this.find( filename );
            else
                this._diagnostics.push( filename );

            if ( !filename || !exists( filename ) || ~this.configFiles.indexOf( path.sep === '\\' ? filename.replace( '\\', '\\\\' ) : filename ) ) continue;

            if ( ( fileConfig = this.get_file( filename ) ) )
            {
                let extIndex = filename.lastIndexOf( '.' ),
                    parsed, _parser;

                if ( extIndex > 0 )
                    _parser = parsers[ lc( filename.substr( extIndex + 1 ) ) ];

                if ( !_parser )
                    _parser = /^[\s\n]*\{/m.test( fileConfig ) ? parsers.json : parsers.ini;

                try {
                    parsed = _parser( fileConfig );
                }
                catch ( err ) {
                    parsed = null;
                }

                if ( !parsed ) continue;

                this.configList.push( parsed );
                this.configFiles.push( file );
                this.cookedConfigFiles.push( filename );
                return;
            }
        }
    }

    /**
     *
     */
    add_files()
    {
        const
            add_cfg = fn => this.add_config_file( fn ),
            search = fn => this.add_config_file( fn, true ),
            etc = '/etc',
            name = this.appName,
            home = os.homedir(),
            cwd = process.cwd(),
            dotName = `.${name}`,
            dotRc = `.${name}rc`,
            all = [ [ '.config', name, 'config' ], [ '.config', name ], [ dotName, 'config' ], [ dotName ], [ dotRc ], [ name ] ],
            inEtc = [ [ name, 'config' ], [ name + 'rc' ], [ name ] ],
            join = args => path.join( ...args );

        if ( os.platform() !== 'win32' )
            inEtc.map( parts => join( etc, ...parts ) ).forEach( add_cfg );

        if ( home )
            all.map( parts => join( home, ...parts ) ).concat( all.map( parts => join( cwd, ...parts ) ) ).forEach( add_cfg );

        [ dotRc, dotName, name ].forEach( search );
    }

    /**
     *
     * @param {string} start
     * @param {string} rel
     * @return {?string}
     * @private
     */
    _find( start, rel )
    {
        const file = path.join( start, rel );

        this._diagnostics.push( file );
        if ( exists( file ) && !~this.configFiles.indexOf( file ) ) return file;

        return path.dirname( start ) !== start ? this._find( path.dirname( start ), rel ) : null;
    }

    /**
     *
     * @param {string} file
     * @return {?string}
     */
    find( file )
    {
        return this._find( process.cwd(), file );
    }
}

module.exports = Configuration;
