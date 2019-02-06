import { Given, When, Then } from 'cucumber';
import * as testKeys from './testKeys';

Given('a custom authoriser lambda', function () {
  // rs-todo: the initial setup setp: overrides console.log, override any external calls in createAdJwtVerifier, and create a "sut" field on this, which points to the handler function
  return 'pending';
});

Given('a valid token', () => {
  throw new Error('rs-todo: implement "Given a valid token"');
});

Given(
  'a token that is valid between {int} hours and {int} hours',
  (startHours: number, endHours: number) => {
    throw new Error(
      `rs-todo: implement a token that is valid between **int** hours and **int** hours:
 ${startHours} ${endHours} ${typeof(startHours)} ${typeof(endHours)}`);
  });

Given('the token\'s payload is changed', () => {
  // rs-todo: Write code here that turns the phrase above into concrete actions
  return 'pending';
});

Given('the token\'s header is changed', () => {
  // rs-todo: Write code here that turns the phrase above into concrete actions
  return 'pending';
});

When('the token is verified', () => {
  // rs-todo: Write code here that turns the phrase above into concrete actions
  return 'pending';
});

Then('the result should Allow access', () => {
  // rs-todo: Write code here that turns the phrase above into concrete actions
  return 'pending';
});

Then('the result should Deny access', () => {
  // rs-todo: Write code here that turns the phrase above into concrete actions
  return 'pending';
});

Then('the failed authorization reason should contain {string}', (failureReason: string) => {
  // rs-todo: Write code here that turns the phrase above into concrete actions
  return 'pending';
});
