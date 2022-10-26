# mes-custom-authorizer

A serverless project to house the authorization code for access to MES microservices.

## Dependencies

DVSA dependencies have been moved from npm to github so in order to install/update any private @DVSA packages
you are required to have an entry in your global `~/.npmrc` file as follows:

```shell
//npm.pkg.github.com/:_authToken=<your auth token here>
```

## Structure

All serverless functions live in dedicated directories in `src/functions`.
Code that is common between multiple functions should reside in `src/common`.

As per the principles of Hexagonal Architecture, each function has the following directories to help us separate concerns:

* `framework` - contains all Inbound and Outbound Adapters, and all use of external/proprietary APIs - depends upon...
* `application` - contains all Inbound and Outbound Ports, doesn't use any external/proprietary APIs - depends upon...
* `domain` - contains all domain objects (Aggregates, Objects, Value classes etc) with all "business logic" (not just anaemic data holders), doesn't use any external/proprietary APIs.

## Build

To build a zip file for every function to `build/artifacts`, run:

```shell
npm run package
```

To build a subset of the functions, pass a comma separated list of function names, like so:

```shell
npm run package -- get,set
```

N.b. The build requires [jq](https://github.com/stedolan/jq).

## Test

To run the unit tests, simply run:

```shell
npm test
```

## Debugging / tracing the `jwks-rsa` package and specifically the `jwksClient`

The `jwksClient` provides the ability to retrieve and cache RSA public keys from the specified
JWKS (JSON Web Key Set) endpoint.

In order to prevent a call to be made each time a signing key needs to be retrieved the
`jwksClient` has been configured to cache as follows.  If a signing key matching the kid is found,
this will be cached and the next time this kid is requested the signing key will be served from
the cache instead of calling back to the JWKS endpoint.

To get trace logs of what the `jwksClient` is doing internally, and how often it is making
requests to the JWKS endpoint, we can enable debugging for just the library by setting the
`DEBUG` envrionment variable to include the value `jwks`.

For example:

```
$ DEBUG=jwks node ./local-test.js eyJ0eXAiOi...
```
