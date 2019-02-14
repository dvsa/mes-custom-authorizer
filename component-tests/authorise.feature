
Feature: As a user of the web API, I want to authenticate and authorize with the system, so that I can access the services provided by the web API.

    Background:
        Given a custom authoriser lambda

    Scenario: Valid token, should Allow access and set methodArn to access all HTTP verbs and resources after the stage for a generic methodArn
        Given a valid token
        And a methodArn of "arn:aws:srvc:region:account:app/stage/verb/some/path"
        When the token is verified
        Then the result should Allow access
        And the result policy methodArn should be "arn:aws:srvc:region:account:app/stage/*/*"

    Scenario: Valid token, should Allow access and set methodArn to access all HTTP verbs and resources after the stage
        Given a valid token
        And a methodArn of "arn:aws:execute-api:us-east-1:3631894:hj389a1c0/stage/GET/journal/10023488/personal"
        When the token is verified
        Then the result should Allow access
        And the result policy methodArn should be "arn:aws:execute-api:us-east-1:3631894:hj389a1c0/stage/*/*"

    Scenario: Invalid signature due to modified token payload, should Deny access
        Given a valid token
        And the token's payload is changed
        When the token is verified
        Then the result should Deny access
        And the failed authorization reason should contain "invalid signature"

    Scenario: Invalid signature due to modified token header, should Deny access
        Given a valid token
        And the token's header is changed
        When the token is verified
        Then the result should Deny access
        And the failed authorization reason should contain "invalid signature"

    Scenario: Invalid due to use of token before valid time range (i.e. not-before), should Deny access
        Given a token that is valid between 2 hours and 3 hours
        When the token is verified
        Then the result should Deny access
        And the failed authorization reason should contain "jwt not active"

    Scenario: Invalid due to use of token after valid time range (i.e. expiration), should Deny access
        Given a token that is valid between -3 hours and -2 hours
        When the token is verified
        Then the result should Deny access
        And the failed authorization reason should contain "jwt expired"

    Scenario: Invalid signature due to signature removal, should Deny access
        Given a valid token
        And the token's signature is removed
        When the token is verified
        Then the result should Deny access
        And the failed authorization reason should contain "jwt signature is required"

    Scenario: Invalid signature due to non-genuine signing certificate, should Deny access
        Given a token signed with a non-genuine certificate
        When the token is verified
        Then the result should Deny access
        And the failed authorization reason should contain "invalid signature"

    Scenario: Invalid source (i.e. identity provider / issuer), should Deny access
        Given a valid token but from a different issuer
        When the token is verified
        Then the result should Deny access
        And the failed authorization reason should contain "jwt issuer invalid"

    Scenario: Invalid target (i.e. application / client / audience), should Deny access
        Given a valid token but intended for another application
        When the token is verified
        Then the result should Deny access
        And the failed authorization reason should contain "jwt audience invalid"
